#!/usr/bin/env node
/**
 * Creates the Baserow tables and fields from the spec files, then optionally
 * loads their rows.
 *
 * The database token in environment.ts cannot do this — table and field
 * creation need a JWT from a user login. This script logs in for one, so you
 * never have to build 25 fields by hand in the UI.
 *
 * CREDENTIALS ARE READ FROM THE ENVIRONMENT AND NEVER WRITTEN ANYWHERE.
 * Do not put them in a file in this repo.
 *
 *   export BASEROW_EMAIL='you@example.com'
 *   export BASEROW_PASSWORD='...'
 *
 * Usage:
 *   node create-tables.js --dry-run                 # show what would be created
 *   node create-tables.js --only 23,24              # just those spec numbers
 *   node create-tables.js                           # create tables + fields
 *   node create-tables.js --with-rows               # ...and load the sample rows
 *
 * Options:
 *   --database <id>  Baserow database id (default 128)
 *   --url <base>     Instance URL (default https://db.jollycares.com)
 *   --only <list>    Comma-separated spec numbers, e.g. 15,16,17
 *   --with-rows      Also import the matching *.rows.json
 *   --dry-run        Print the plan; change nothing
 *
 * Link fields are deliberately skipped — see README.md. Create them last, by
 * hand, once every table exists.
 */

const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));
const BASE = (args.url || 'https://db.jollycares.com').replace(/\/$/, '');
const DATABASE_ID = args.database || '128';
const SCHEMA_DIR = path.resolve(__dirname, '..');
const DRY = !!args['dry-run'];

/** Spec field type -> Baserow field payload. */
const FIELD_TYPES = {
  text: () => ({ type: 'text' }),
  long_text: () => ({ type: 'long_text' }),
  url: () => ({ type: 'url' }),
  boolean: () => ({ type: 'boolean' }),
  number: () => ({ type: 'number', number_decimal_places: 0, number_negative: true }),
  date: () => ({ type: 'date', date_format: 'ISO', date_include_time: false }),
  date_time: () => ({ type: 'date', date_format: 'ISO', date_include_time: true }),
  single_select: def => ({
    type: 'single_select',
    select_options: (def.options || []).map((value, i) => ({ value, color: COLORS[i % COLORS.length] }))
  })
};

const COLORS = [
  'light-blue', 'light-green', 'light-orange', 'light-red', 'light-gray',
  'blue', 'green', 'orange', 'red', 'gray',
  'dark-blue', 'dark-green', 'dark-orange', 'dark-red', 'dark-gray',
  'darker-blue', 'darker-green', 'darker-orange', 'darker-red', 'darker-gray'
];

/** Never created by this script. */
const SKIPPED_TYPES = new Set(['auto_number', 'link']);

main().catch(err => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});

async function main() {
  const specs = loadSpecs();
  if (specs.length === 0) throw new Error('No matching spec files found.');

  console.log(`Instance : ${BASE}`);
  console.log(`Database : ${DATABASE_ID}`);
  console.log(`Tables   : ${specs.map(s => s.schema.table_name).join(', ')}\n`);

  if (DRY) {
    for (const spec of specs) plan(spec);
    console.log('Dry run — nothing was created.');
    return;
  }

  const jwt = await login();
  const created = [];

  for (const spec of specs) {
    const id = await createTable(jwt, spec);
    created.push({ name: spec.schema.table_name, id, envKey: envKeyFor(spec.schema.table_name) });
    if (args['with-rows']) await importRows(spec, id);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('Paste into src/environments/environment.ts under baserow.tables:\n');
  for (const t of created) console.log(`      ${t.envKey}: ${t.id},`);
  console.log('\nThen create the link fields by hand — see README.md.');
}

function loadSpecs() {
  const only = args.only ? String(args.only).split(',').map(s => s.trim()) : null;

  return fs
    .readdirSync(__dirname)
    .filter(f => f.endsWith('.rows.json'))
    .map(rowsFile => {
      const num = rowsFile.split('-')[0];
      const schemaFile = rowsFile.replace('.rows.json', '.json');
      const schemaPath = path.join(SCHEMA_DIR, schemaFile);
      if (!fs.existsSync(schemaPath)) return null;
      return {
        num,
        rowsFile,
        schema: JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
      };
    })
    .filter(Boolean)
    .filter(s => !only || only.includes(s.num))
    .sort((a, b) => Number(a.num) - Number(b.num));
}

function creatableFields(schema) {
  return Object.entries(schema.fields || {})
    .filter(([name, def]) => !SKIPPED_TYPES.has(def.type) && name !== 'id')
    // created_at / updated_at are auto in the spec; Baserow manages its own.
    .filter(([, def]) => !def.auto_now && !def.auto_now_add);
}

function plan(spec) {
  const fields = creatableFields(spec.schema);
  const skipped = Object.entries(spec.schema.fields || {}).filter(([n, d]) =>
    SKIPPED_TYPES.has(d.type) && n !== 'id'
  );

  console.log(`${spec.schema.table_name}`);
  console.log(`  ${fields.length} field(s) to create`);
  for (const [name, def] of fields) {
    const options = def.type === 'single_select' ? ` (${(def.options || []).length} options)` : '';
    console.log(`    ${name.padEnd(24)} ${def.type}${options}`);
  }
  if (skipped.length) {
    console.log(`  skipped (create by hand): ${skipped.map(([n]) => n).join(', ')}`);
  }
  console.log('');
}

async function login() {
  const email = process.env.BASEROW_EMAIL;
  const password = process.env.BASEROW_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set BASEROW_EMAIL and BASEROW_PASSWORD in your environment.\n' +
        '  export BASEROW_EMAIL=\'you@example.com\'\n' +
        '  export BASEROW_PASSWORD=\'...\'\n' +
        'They are used for this one login and never written to disk.'
    );
  }

  const res = await fetch(`${BASE}/api/user/token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    throw new Error(`Login failed (HTTP ${res.status}). Check the email and password.`);
  }

  const body = await res.json();
  // Baserow renamed this between versions.
  const jwt = body.access_token || body.token;
  if (!jwt) throw new Error('Login succeeded but no token was returned.');

  console.log(`✓ Logged in as ${email}\n`);
  return jwt;
}

async function createTable(jwt, spec) {
  const headers = { Authorization: `JWT ${jwt}`, 'Content-Type': 'application/json' };
  const name = spec.schema.table_name;

  const res = await fetch(`${BASE}/api/database/tables/database/${DATABASE_ID}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    throw new Error(`Creating table '${name}' failed (HTTP ${res.status}): ${await res.text()}`);
  }

  const table = await res.json();
  console.log(`✓ ${name} — table ${table.id}`);

  // A new table arrives with Baserow's default Name/Notes/Active fields and two
  // blank rows. Repurpose the primary field, drop the rest, then add ours.
  const existing = await (await fetch(`${BASE}/api/database/fields/table/${table.id}/`, { headers })).json();
  const primary = existing.find(f => f.primary);
  const fields = creatableFields(spec.schema);
  const [firstName, firstDef] = fields[0];

  // The primary field cannot be deleted, so it becomes our first column.
  await fetch(`${BASE}/api/database/fields/${primary.id}/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: firstName, ...FIELD_TYPES[firstDef.type](firstDef) })
  });
  console.log(`    ${firstName} (primary)`);

  for (const field of existing.filter(f => !f.primary)) {
    await fetch(`${BASE}/api/database/fields/${field.id}/`, { method: 'DELETE', headers });
  }

  for (const [fieldName, def] of fields.slice(1)) {
    const builder = FIELD_TYPES[def.type];
    if (!builder) {
      console.log(`    ${fieldName} — unmapped type '${def.type}', skipped`);
      continue;
    }

    const fieldRes = await fetch(`${BASE}/api/database/fields/table/${table.id}/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: fieldName, ...builder(def) })
    });

    if (!fieldRes.ok) {
      console.log(`    ${fieldName} — FAILED (HTTP ${fieldRes.status}): ${await fieldRes.text()}`);
      continue;
    }
    console.log(`    ${fieldName}`);
  }

  // Remove the two blank rows Baserow seeds a new table with.
  const rowsUrl = `${BASE}/api/database/rows/table/${table.id}/?user_field_names=true`;
  const seeded = await (await fetch(rowsUrl, { headers })).json();
  for (const row of seeded.results || []) {
    await fetch(`${BASE}/api/database/rows/table/${table.id}/${row.id}/`, {
      method: 'DELETE',
      headers
    });
  }

  return table.id;
}

async function importRows(spec, tableId) {
  const { execFileSync } = require('child_process');
  console.log(`    loading ${spec.rowsFile}...`);
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'import-rows.js'), '--table', String(tableId), '--file', spec.rowsFile],
    { stdio: 'inherit' }
  );
}

/** campaign_participants -> campaignParticipants, to match environment.ts. */
function envKeyFor(tableName) {
  return tableName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
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
