#!/usr/bin/env node
/**
 * Verifies the import files against the schema specs.
 *
 * The point: Baserow's importer creates a single-select field's options from
 * the values it actually finds in the data. If a row set never uses an option,
 * that option simply will not exist in the imported table, and you would only
 * discover it the first time the app tried to write that value.
 *
 * Run from anywhere:  node database-schemas/baserow-import/verify-coverage.js
 * Exits non-zero if any option is uncovered or any row set is malformed.
 */

const fs = require('fs');
const path = require('path');

const importDir = __dirname;
const schemaDir = path.resolve(__dirname, '..');

let failures = 0;
let checkedTables = 0;
let checkedOptions = 0;
const warnings = [];

const rowFiles = fs
  .readdirSync(importDir)
  .filter(f => f.endsWith('.rows.json'))
  .sort();

for (const rowFile of rowFiles) {
  const schemaFile = rowFile.replace('.rows.json', '.json');
  const schemaPath = path.join(schemaDir, schemaFile);

  if (!fs.existsSync(schemaPath)) {
    console.error(`✗ ${rowFile}: no matching schema at ${schemaFile}`);
    failures++;
    continue;
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const rows = JSON.parse(fs.readFileSync(path.join(importDir, rowFile), 'utf8'));
  checkedTables++;

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(`✗ ${rowFile}: expected a non-empty array of row objects`);
    failures++;
    continue;
  }

  const problems = [];

  // Every row must carry the same keys, or Baserow ends up with ragged columns.
  const keys = Object.keys(rows[0]);
  rows.forEach((row, i) => {
    const rowKeys = Object.keys(row);
    const missing = keys.filter(k => !rowKeys.includes(k));
    const extra = rowKeys.filter(k => !keys.includes(k));
    if (missing.length) problems.push(`row ${i}: missing ${missing.join(', ')}`);
    if (extra.length) problems.push(`row ${i}: unexpected ${extra.join(', ')}`);
  });

  // Columns in the data that the schema does not define.
  const schemaFields = Object.keys(schema.fields || {});
  const unknown = keys.filter(k => !schemaFields.includes(k));
  if (unknown.length) problems.push(`columns not in the schema: ${unknown.join(', ')}`);

  // Columns the schema marks auto (created_at / updated_at). create-tables.js
  // does not create these — Baserow stamps its own — so supplying them means
  // the row data has a column the table will not have, and the import aborts.
  const autoSupplied = keys.filter(k => {
    const def = schema.fields?.[k];
    return def && (def.auto_now || def.auto_now_add);
  });
  if (autoSupplied.length) {
    problems.push(
      `auto field(s) supplied in the data — Baserow sets these itself, remove them: ${autoSupplied.join(', ')}`
    );
  }

  // Required fields must be present and non-empty in every row.
  for (const [field, def] of Object.entries(schema.fields || {})) {
    if (!def.required) continue;
    if (field === 'id') continue;
    // Link fields are created after import, so they are legitimately absent.
    if (def.type === 'link') continue;
    if (!keys.includes(field)) {
      problems.push(`required field '${field}' is missing from every row`);
      continue;
    }
    const blank = rows.filter(r => r[field] === '' || r[field] === null || r[field] === undefined);
    if (blank.length) problems.push(`required field '${field}' is blank in ${blank.length} row(s)`);
  }

  // The main event: every select option must appear at least once.
  for (const [field, def] of Object.entries(schema.fields || {})) {
    if (def.type !== 'single_select' || !Array.isArray(def.options)) continue;
    checkedOptions += def.options.length;

    const used = new Set(rows.map(r => r[field]).filter(v => v !== '' && v != null));
    const uncovered = def.options.filter(o => !used.has(o));
    const invalid = [...used].filter(v => !def.options.includes(v));

    if (uncovered.length) problems.push(`${field}: no row uses ${uncovered.join(', ')}`);
    if (invalid.length) problems.push(`${field}: value(s) not in the schema: ${invalid.join(', ')}`);
  }

  // Booleans must be real booleans, not the strings "true"/"false" — Baserow
  // would import those as text.
  for (const [field, def] of Object.entries(schema.fields || {})) {
    if (def.type !== 'boolean' || !keys.includes(field)) continue;
    const wrong = rows.filter(r => typeof r[field] !== 'boolean');
    if (wrong.length) problems.push(`${field}: ${wrong.length} row(s) are not true/false`);

    // Showing both values is nice for reviewing the import, but unlike a
    // dropdown a boolean has no options to discover, so this is not a failure.
    // Some fields are uniformly false on purpose (challenge allows_partner).
    const values = new Set(rows.map(r => r[field]));
    if (!values.has(true) || !values.has(false)) {
      warnings.push(`${rowFile}: ${field} only ever shows ${[...values].join('/')}`);
    }
  }

  if (problems.length) {
    console.error(`✗ ${rowFile}`);
    problems.forEach(p => console.error(`    ${p}`));
    failures += problems.length;
  } else {
    const selects = Object.entries(schema.fields || {}).filter(
      ([, d]) => d.type === 'single_select'
    ).length;
    console.log(`✓ ${rowFile.padEnd(38)} ${rows.length} rows, ${selects} dropdown(s) fully covered`);
  }
}

if (warnings.length) {
  console.log('');
  warnings.forEach(w => console.log(`  note: ${w}`));
}

console.log(
  `\n${checkedTables} table(s), ${checkedOptions} dropdown option(s) checked — ${
    failures === 0 ? 'all covered' : `${failures} problem(s)`
  }`
);

process.exit(failures === 0 ? 0 : 1);
