#!/usr/bin/env node
/**
 * Creates a Baserow table from one of the database-schemas/NN-*.json files.
 *
 * WHY THIS EXISTS
 * The API token the app ships is a Baserow *database token*: it can read and
 * write rows, and read field definitions, but every table-management endpoint
 * rejects it with "Authentication credentials were not provided". Creating a
 * table needs a user JWT, which means a real login.
 *
 * CONFIGURATION AND CREDENTIALS
 * All from the environment, all required, so they never land in a file or a
 * shell history — and so this can never guess which database to write to:
 *
 *   export BASEROW_URL=https://db.example.com
 *   export BASEROW_DATABASE_ID=128
 *   export BASEROW_EMAIL=you@example.com
 *   read -s BASEROW_PASSWORD && export BASEROW_PASSWORD
 *
 * BASEROW_URL and BASEROW_DATABASE_ID previously defaulted to one specific
 * instance and database. A default is fine for a value that is merely
 * convenient; these two decide WHERE SCHEMA GETS WRITTEN, and getting that
 * silently wrong is unrecoverable in a way a missing-variable error is not.
 * Run with --list-databases to see the ids you can choose from.
 *
 * USAGE
 *   node scripts/create-baserow-table.mjs 26-user-onboarding.json            # dry run
 *   node scripts/create-baserow-table.mjs 26-user-onboarding.json --apply    # actually create
 *
 * Dry run is the default on purpose: this writes schema to a shared database.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'database-schemas');

const [, , schemaArg, ...flags] = process.argv;
const APPLY = flags.includes('--apply');
const LIST_DATABASES = process.argv.includes('--list-databases');

/**
 * Exits rather than guessing.
 *
 * Both values below decide which Baserow instance and database this writes
 * schema to. A default would turn a moved file or an unset shell into a silent
 * write against the wrong database.
 */
function required(value, name, description) {
  if (value) return value;
  console.error(`\n  Missing ${name} — ${description}.\n`);
  console.error(`  Set it in the environment:  ${name}=... node ${process.argv[1]} ...\n`);
  process.exit(1);
}

const BASE_URL = required(
  process.env.BASEROW_URL,
  'BASEROW_URL',
  'the Baserow host, e.g. https://db.example.com'
);

// --list-databases is how you FIND the id, so it must not demand one first.
const DATABASE_ID = LIST_DATABASES
  ? Number(process.env.BASEROW_DATABASE_ID ?? 0)
  : Number(
      required(
        process.env.BASEROW_DATABASE_ID,
        'BASEROW_DATABASE_ID',
        'the database to create the table in — run with --list-databases to see the ids'
      )
    );

if (!schemaArg && !LIST_DATABASES) {
  console.error('usage: node scripts/create-baserow-table.mjs <schema-file.json> [--apply]\n');
  console.error('available schemas:');
  for (const f of readdirSync(SCHEMA_DIR).filter(f => /^\d+-.*\.json$/.test(f)).sort()) {
    console.error('  ' + f);
  }
  process.exit(1);
}

const schema = LIST_DATABASES
  ? { table_name: '', fields: {} }
  : JSON.parse(readFileSync(join(SCHEMA_DIR, schemaArg), 'utf8'));

/**
 * Maps a schema field spec to Baserow's field-create payload.
 *
 * Baserow will not infer any of this — a `number` field defaults to
 * non-negative, which silently rejects the -1 sentinel `guide_step_index`
 * uses to mean "finished".
 */
function toBaserowField(name, spec) {
  const base = { name };

  switch (spec.type) {
    case 'text':
      return { ...base, type: 'text' };

    case 'long_text':
      return { ...base, type: 'long_text' };

    case 'boolean':
      return { ...base, type: 'boolean' };

    case 'number':
      return {
        ...base,
        type: 'number',
        /**
         * Defaults to 0, but a schema can ask for more.
         *
         * Baserow does not round an over-precise value — it REJECTS the whole
         * row ("Ensure that there are no more than 0 decimal places"), so a
         * 2.5-hour estimate loses the entire task, not just the field.
         */
        number_decimal_places: spec.decimal_places ?? 0,
        // guide_step_index stores -1 for "finished". Without this the API
        // accepts the field and then rejects every write of that sentinel.
        number_negative: true
      };

    case 'single_select':
      return {
        ...base,
        type: 'single_select',
        select_options: (spec.options ?? []).map(value => ({ value, color: 'light-blue' }))
      };

    case 'date_time':
      return {
        ...base,
        type: 'date',
        date_format: 'ISO',
        date_include_time: true,
        date_time_format: '24'
      };

    case 'date':
      // `auto_now_add` means "stamped on insert" (created_on) and `auto_now`
      // means "stamped on every write" (last_modified). Neither is a writable
      // date column, and creating one as writable means nothing ever stamps it.
      if (spec.auto_now_add) {
        return { ...base, type: 'created_on', date_format: 'ISO', date_include_time: true };
      }
      if (spec.auto_now) {
        return { ...base, type: 'last_modified', date_format: 'ISO', date_include_time: true };
      }
      return { ...base, type: 'date', date_format: 'ISO' };

    case 'auto_number':
      // Baserow supplies the row id itself; never create a column for it.
      return null;

    default:
      throw new Error(`unmapped field type "${spec.type}" on "${name}"`);
  }
}

const fields = Object.entries(schema.fields)
  .map(([name, spec]) => ({ name, spec, payload: toBaserowField(name, spec) }))
  .filter(f => f.payload !== null);

const primary = Object.entries(schema.fields).find(([, s]) => s.primary && s.type !== 'auto_number');
// Baserow's primary field cannot be deleted, so the first real column becomes
// it by renaming the auto-created "Name" rather than adding a new one.
const primaryName = primary ? primary[0] : fields[0]?.name;

// --list-databases has no schema, and must not be swallowed by the dry-run
// exit below — it is a query, not a table creation.
if (!LIST_DATABASES) {
  console.log(`\n${APPLY ? 'CREATING' : 'DRY RUN —'} table "${schema.table_name}" in database ${DATABASE_ID} at ${BASE_URL}`);
  console.log(`  primary field: ${primaryName} (renamed from Baserow's default "Name")`);
  for (const f of fields) {
    if (f.name === primaryName) continue;
    const extra = f.payload.select_options
      ? ` [${f.payload.select_options.map(o => o.value).join(', ')}]`
      : f.payload.type === 'number'
        ? ` (${f.payload.number_decimal_places} dp, negatives allowed)`
        : '';
    console.log(`  + ${f.name.padEnd(20)} ${f.payload.type}${extra}`);
  }
  console.log(`\n  ${fields.length} fields total\n`);

  if (!APPLY) {
    console.log('Nothing was written. Re-run with --apply to create it.\n');
    process.exit(0);
  }
}

const email = process.env.BASEROW_EMAIL;
const password = process.env.BASEROW_PASSWORD;

if (!email || !password) {
  console.error('BASEROW_EMAIL and BASEROW_PASSWORD must be set.');
  console.error('  export BASEROW_EMAIL=you@example.com');
  console.error('  read -s BASEROW_PASSWORD && export BASEROW_PASSWORD');
  process.exit(1);
}

/**
 * Writing a table into the wrong database is tedious to undo, and the ids are
 * not guessable — this instance has more than one, and the scheduler app owns
 * tables named `projects` and `tasks` that look like they belong to Habiti.
 *
 * Placed AFTER the credential consts on purpose: it signs in, and `const` is
 * not hoisted the way a function declaration is.
 */
async function listDatabases() {
  const jwt = await signIn();
  const apps = await api('/api/applications/', { jwt });

  console.log('\nDatabases on this instance:\n');
  for (const app of apps) {
    const marker = app.id === DATABASE_ID ? '   <- BASEROW_DATABASE_ID' : '';
    console.log(`  ${String(app.id).padEnd(6)} ${app.name}${marker}`);
    for (const table of app.tables ?? []) {
      console.log(`         ${String(table.id).padEnd(5)} ${table.name}`);
    }
  }
  console.log('\n  Set BASEROW_DATABASE_ID to the database you want to write to.\n');
}

async function api(path, { method = 'GET', body, jwt } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `JWT ${jwt}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}\n${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function signIn() {
  const auth = await api('/api/user/token-auth/', {
    method: 'POST',
    body: { email, password }
  });
  return auth.token ?? auth.access_token;
}

if (LIST_DATABASES) {
  try {
    await listDatabases();
  } catch (err) {
    // A stack trace here helps nobody — the only two causes are bad
    // credentials and the wrong host.
    if (String(err.message).includes('401')) {
      console.error('\n  Baserow rejected the credentials.\n');
      console.error(`  host    ${BASE_URL}`);
      console.error(`  email   ${email}`);
      console.error(`  password ${password.length} characters\n`);
      console.error('  If that length is not what you typed, the shell ate part of it —');
      console.error('  use: read -s BASEROW_PASSWORD && export BASEROW_PASSWORD\n');
    } else {
      console.error('\n  Could not list databases:', err.message, '\n');
    }
    process.exit(1);
  }
  process.exit(0);
}

try {
  console.log('Signing in…');
  const jwt = await signIn();
  console.log(`  signed in as ${email}`);

  const existing = await api(`/api/database/tables/database/${DATABASE_ID}/`, { jwt });
  const clash = existing.find(t => t.name === schema.table_name);
  if (clash) {
    console.error(`\nA table named "${schema.table_name}" already exists (id ${clash.id}). Aborting.`);
    console.error('Delete it in Baserow first if you meant to recreate it.');
    process.exit(1);
  }

  console.log(`Creating table "${schema.table_name}"…`);
  const table = await api(`/api/database/tables/database/${DATABASE_ID}/`, {
    method: 'POST',
    jwt,
    body: { name: schema.table_name }
  });
  console.log(`  table id ${table.id}`);

  // A new Baserow table arrives with Name/Notes/Active and two blank rows.
  const defaults = await api(`/api/database/fields/table/${table.id}/`, { jwt });

  const nameField = defaults.find(f => f.primary);
  const primarySpec = fields.find(f => f.name === primaryName);
  console.log(`Renaming primary "${nameField.name}" → "${primaryName}"…`);
  await api(`/api/database/fields/${nameField.id}/`, {
    method: 'PATCH',
    jwt,
    body: { ...primarySpec.payload }
  });

  for (const f of defaults.filter(f => !f.primary)) {
    console.log(`Removing default field "${f.name}"…`);
    await api(`/api/database/fields/${f.id}/`, { method: 'DELETE', jwt });
  }

  for (const f of fields) {
    if (f.name === primaryName) continue;
    console.log(`Adding "${f.name}" (${f.payload.type})…`);
    await api(`/api/database/fields/table/${table.id}/`, {
      method: 'POST',
      jwt,
      body: f.payload
    });
  }

  const blanks = await api(`/api/database/rows/table/${table.id}/?user_field_names=true`, { jwt });
  for (const row of blanks.results ?? []) {
    await api(`/api/database/rows/table/${table.id}/${row.id}/`, { method: 'DELETE', jwt });
  }
  if (blanks.results?.length) console.log(`Removed ${blanks.results.length} blank starter rows.`);

  console.log(`\n✅ Created "${schema.table_name}" — table id ${table.id}\n`);
  console.log('Now set it in src/environments/environment.ts:');
  console.log(`    userOnboarding: ${table.id},\n`);
} catch (err) {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
}
