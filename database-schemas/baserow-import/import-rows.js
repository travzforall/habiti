#!/usr/bin/env node
/**
 * Bulk-loads a *.rows.json file into an existing Baserow table.
 *
 * WHAT THIS DOES NOT DO: create the table or its fields. The API token in
 * environment.ts is a *database token* — it can read schema and read/write
 * rows, but POST /api/database/tables/... returns 401 for it. Creating tables
 * needs a JWT from a user login. So create the table in the Baserow UI first
 * (see README.md), then point this at it.
 *
 * Usage:
 *   node import-rows.js --table 531 --file 23-daily-content.rows.json --dry-run
 *   node import-rows.js --table 531 --file 23-daily-content.rows.json
 *
 * Options:
 *   --table <id>     Baserow table id (required)
 *   --file <name>    A *.rows.json file in this directory (required)
 *   --token <token>  Overrides the token read from environment.ts
 *   --url <base>     Overrides the API base URL
 *   --dry-run        Validate and report; send nothing
 *
 * Always dry-run first: it checks your row keys against the table's real
 * fields and tells you which columns would be silently dropped.
 */

const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));

if (!args.table || !args.file) {
  console.error('Usage: node import-rows.js --table <id> --file <name.rows.json> [--dry-run]');
  process.exit(2);
}

const BATCH_SIZE = 200; // Baserow's documented per-request limit for /batch/
const envPath = path.resolve(__dirname, '../../src/environments/environment.ts');
const token = args.token || readFromEnv(/token:\s*'([^']+)'/);
const baseUrl = (args.url || readFromEnv(/apiUrl:\s*'([^']+)'/) || '').replace(/\/$/, '');

if (!token || !baseUrl) {
  console.error('Could not read the Baserow token/apiUrl from environment.ts. Pass --token/--url.');
  process.exit(2);
}

const filePath = path.join(__dirname, String(args.file));

if (!fs.existsSync(filePath)) {
  console.error(`\n✗ No such file: ${args.file}`);

  // A trailing '.' copied from the end of a sentence is the usual cause.
  const trimmed = String(args.file).replace(/\.+$/, '');
  if (trimmed !== args.file && fs.existsSync(path.join(__dirname, trimmed))) {
    console.error(`\n  Did you mean:  --file ${trimmed}`);
    console.error('  (there is a trailing "." on the name you passed)');
  } else {
    console.error('\n  Available files:');
    fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.rows.json'))
      .forEach(f => console.error(`    ${f}`));
  }
  console.error('');
  process.exit(2);
}

let rows;
try {
  rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (err) {
  console.error(`\n✗ ${args.file} is not valid JSON: ${err.message}\n`);
  process.exit(2);
}

if (!Array.isArray(rows) || rows.length === 0) {
  console.error(`\n✗ ${args.file} is not a non-empty array of row objects.\n`);
  process.exit(2);
}

main().catch(err => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});

async function main() {
  const headers = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };

  // Compare our columns against the table's actual fields. Baserow silently
  // ignores unknown keys, so without this a typo looks like a clean import
  // that quietly dropped a column.
  const fieldsUrl = `${baseUrl.replace('/rows/table', '/fields/table')}/${args.table}/`;
  const fieldsRes = await fetch(fieldsUrl, { headers });
  if (!fieldsRes.ok) {
    throw new Error(
      `Could not read fields for table ${args.table} (HTTP ${fieldsRes.status}). ` +
        'Check the table id, and that the token has access to this database.'
    );
  }

  const fields = await fieldsRes.json();
  const fieldNames = new Set(fields.map(f => f.name));
  const rowKeys = Object.keys(rows[0]);

  const unknown = rowKeys.filter(k => !fieldNames.has(k));
  const missing = [...fieldNames].filter(
    f => !rowKeys.includes(f) && !['id', 'created_at', 'updated_at'].includes(f)
  );

  console.log(`Table ${args.table} — ${fields.length} fields`);
  console.log(`File  ${args.file} — ${rows.length} rows, ${rowKeys.length} columns\n`);

  if (unknown.length) {
    console.log(`⚠ ${unknown.length} column(s) do not exist on the table and WILL BE DROPPED:`);
    unknown.forEach(k => console.log(`    ${k}`));
    console.log('  Create these fields first, or the data is lost silently.\n');
  }
  if (missing.length) {
    console.log(`· ${missing.length} table field(s) have no data in this file:`);
    console.log(`    ${missing.join(', ')}\n`);
  }

  // Warn where a select option in the data does not exist on the field yet.
  for (const field of fields.filter(f => f.type === 'single_select')) {
    if (!rowKeys.includes(field.name)) continue;
    const known = new Set((field.select_options || []).map(o => o.value));
    const used = new Set(rows.map(r => r[field.name]).filter(v => v !== '' && v != null));
    const unknownOptions = [...used].filter(v => !known.has(v));
    if (unknownOptions.length) {
      console.log(
        `⚠ ${field.name}: option(s) not defined on the field — ${unknownOptions.join(', ')}`
      );
      console.log('  Baserow rejects unknown select values. Add them to the field first.\n');
    }
  }

  if (args['dry-run']) {
    console.log(`Dry run — nothing sent. ${rows.length} row(s) would be written.`);
    return;
  }

  if (unknown.length) {
    throw new Error('Refusing to import while columns would be dropped. Fix the fields, or re-run with the fields created.');
  }

  const normalized = rows.map(row => normalizeRow(row, fields));
  const batches = chunk(normalized, BATCH_SIZE);
  let written = 0;

  for (const [i, batch] of batches.entries()) {
    const res = await fetch(`${baseUrl}/${args.table}/batch/?user_field_names=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: batch })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Batch ${i + 1}/${batches.length} failed (HTTP ${res.status}): ${body.slice(0, 500)}\n` +
          `${written} row(s) were already written — Baserow has no transaction across batches, ` +
          'so delete those before retrying or you will get duplicates.'
      );
    }

    written += batch.length;
    console.log(`  batch ${i + 1}/${batches.length} — ${written}/${rows.length} rows`);
  }

  console.log(`\n✓ Imported ${written} row(s) into table ${args.table}.`);
}

/**
 * Coerces a row to what Baserow will accept, using the table's real field types.
 *
 * JSON has no natural "empty" for a date, so the row files use "" for absent
 * optional values — which Baserow accepts for text but rejects outright for
 * date, number and select fields ("Date has wrong format"). Empty means null
 * for those.
 */
function normalizeRow(row, fields) {
  const byName = new Map(fields.map(f => [f.name, f]));
  const out = {};

  for (const [key, value] of Object.entries(row)) {
    const field = byName.get(key);
    if (!field) continue;

    const isEmpty = value === '' || value === null || value === undefined;

    switch (field.type) {
      case 'date':
      case 'number':
      case 'single_select':
      case 'link_row':
        out[key] = isEmpty ? null : value;
        break;
      case 'boolean':
        out[key] = value === true;
        break;
      default:
        out[key] = isEmpty ? '' : value;
    }
  }

  return out;
}

function readFromEnv(pattern) {
  try {
    const match = fs.readFileSync(envPath, 'utf8').match(pattern);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
