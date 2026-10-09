#!/usr/bin/env node
/**
 * Brings the database up to what the app expects — in one command.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Features ship switched off when their table does not exist: attachments,
 * checklists, inspiration boards, mind maps (two tables), project milestones,
 * plus any column missing from a table that DOES exist. Each one was a separate
 * `create-baserow-table.mjs` run followed by copying a numeric id into
 * environment.ts by hand, and a missed paste looks exactly like a working app
 * that quietly saves nothing to the server.
 *
 * So: this checks what is already there, creates only what is missing, adds
 * only the columns that are absent, and rewrites the ids in environment.ts
 * itself.
 *
 * IDEMPOTENT. Run it as often as you like — an existing table is reported and
 * skipped, an existing column is left alone. It never deletes or alters
 * anything that already exists.
 *
 * ── WHY IT NEEDS A LOGIN ──────────────────────────────────────────────────
 *
 * The token the app ships is a Baserow *database token*: rows only. Creating a
 * table or a field needs a user JWT, which means real credentials. They are
 * read from the environment and never written anywhere.
 *
 *   export BASEROW_URL=https://db.example.com
 *   export BASEROW_DATABASE_ID=128
 *   export BASEROW_EMAIL=you@example.com
 *
 *   node scripts/setup-baserow.mjs              # dry run: says what it would do
 *   node scripts/setup-baserow.mjs --apply      # creates tables and columns
 *   node scripts/setup-baserow.mjs --apply --write-env   # ...and updates environment.ts
 *
 * The password is ASKED FOR when it is needed, so the whole block above can be
 * pasted in one go. BASEROW_PASSWORD or --password-file <path> work too, for a
 * run with no terminal attached.
 *
 * Dry run is the default, deliberately: this writes schema to a shared
 * database.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'database-schemas');
const ENVIRONMENT = join(ROOT, 'apps/habiti/src/environments/environment.ts');

const APPLY = process.argv.includes('--apply');
const WRITE_ENV = process.argv.includes('--write-env');

/**
 * Tables the app is waiting for, and the `environment.ts → baserow.tables` key
 * each one fills in.
 */
const TABLES = [
  { schema: '31-task-attachments.json', envKey: 'taskAttachments', feature: 'attachments on tasks and projects' },
  { schema: '32-task-checklist-items.json', envKey: 'taskChecklistItems', feature: 'task checklists' },
  { schema: '33-inspiration-items.json', envKey: 'inspirationItems', feature: 'inspiration boards' },
  { schema: '34-mind-maps.json', envKey: 'mindMaps', feature: 'mind maps' },
  { schema: '35-mind-map-nodes.json', envKey: 'mindMapNodes', feature: 'mind map nodes' },
  { schema: '36-project-milestones.json', envKey: 'projectMilestones', feature: 'project milestones' },
  { schema: '37-project-items.json', envKey: 'projectItems', feature: 'item lists and the item plan' },
  { schema: '38-project-expenses.json', envKey: 'projectExpenses', feature: 'expenses and budgets' },
  { schema: '39-project-plans.json', envKey: 'projectPlans', feature: 'the project planner' },
  { schema: '40-project-tools.json', envKey: 'projectTools', feature: 'tools needed for a job' },
  { schema: '41-user-supplies.json', envKey: 'userSupplies', feature: 'your own tools and materials list' },
  { schema: '42-toolkit-items.json', envKey: 'toolkitItems', feature: 'the standing kit at /toolkit' },
  /**
   * Last, and the one that matters most if the run is interrupted.
   *
   * The acceptance gate, the Article 9 consent prompts and the re-acceptance
   * flow all shipped before this table existed, so ConsentService has been
   * recording every acceptance to localStorage — which means a cache clear
   * erases the record that someone agreed to anything.
   *
   * Note what a row here is and is not. While the Baserow token ships in the
   * client bundle, a user can write this table directly, so a row is
   * CORROBORATION of an acceptance and not evidence of one. The schema file
   * says the same. It is still worth having: corroboration that survives a
   * cache clear beats a localStorage key that does not.
   */
  { schema: '30-legal-acceptances.json', envKey: 'legalAcceptances', feature: 'a durable record of document acceptances and Article 9 consent' }
];

/**
 * Columns the app writes that existing tables do not have yet.
 *
 * The SPEC comes from the schema file rather than being repeated here, so
 * there is one description of every column in the repo and this cannot drift
 * from what `verify:fields` checks.
 */
const COLUMNS = [
  // The project's own budget figure lives on the project row.
  { table: 630, schema: '27-user-projects.json', fields: ['budget', 'currency'] },
  // status, progress_pct and milestone_id were added to 631 on 2026-08-16, and
  // type to 630; only depends_on is still absent. Listing a column that already
  // exists is harmless — it is checked before it is created — but the list is
  // kept honest anyway, because `verify:fields` now fails when it is not.
  { table: 631, schema: '28-user-tasks.json', fields: ['budget'] },
  { table: 630, schema: '27-user-projects.json', fields: ['sort_order'] }
];

// ---------------------------------------------------------------------------

function required(value, name, description) {
  if (value) return value;
  console.error(`\n  Missing ${name} — ${description}.\n`);
  process.exit(1);
}

const BASE_URL = required(process.env.BASEROW_URL, 'BASEROW_URL', 'the Baserow host');
const DATABASE_ID = Number(
  required(process.env.BASEROW_DATABASE_ID, 'BASEROW_DATABASE_ID', "the app's database id")
);
const EMAIL = required(process.env.BASEROW_EMAIL, 'BASEROW_EMAIL', 'the login email');

/**
 * The password: from the environment, from a file, or asked for here.
 *
 * ── WHY THIS PROMPTS ──────────────────────────────────────────────────────
 *
 * The instructions used to say `read -s BASEROW_PASSWORD && export
 * BASEROW_PASSWORD` on one line of a block meant to be pasted whole. `read`
 * takes its input from stdin — which, in a paste, is THE NEXT LINE. So the
 * password silently became "npm run db:setup", the login 401'd, and the error
 * pointed at credentials rather than at the paste. Nothing could be written, so
 * it was harmless, but it was baffling, which is its own kind of bad.
 *
 * Asking here means the whole block can be pasted at once and the prompt still
 * gets a person's answer. Typed characters are not echoed.
 *
 * A non-interactive run (CI, a pipe) has no terminal to ask, so it still
 * requires BASEROW_PASSWORD or --password-file and says so.
 */
async function resolvePassword() {
  if (process.env.BASEROW_PASSWORD) return process.env.BASEROW_PASSWORD;

  const fileFlag = process.argv.indexOf('--password-file');
  if (fileFlag !== -1 && process.argv[fileFlag + 1]) {
    return readFileSync(process.argv[fileFlag + 1], 'utf8').trim();
  }

  if (!process.stdin.isTTY) {
    console.error('\n  Missing BASEROW_PASSWORD — the login password.');
    console.error('  Not a terminal, so it cannot be asked for. Set the variable or pass');
    console.error('  --password-file <path>.\n');
    process.exit(1);
  }

  process.stdout.write(`  Password for ${EMAIL}: `);

  return new Promise(resolve => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(value);
    };

    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') return finish();
        // Ctrl-C has to still mean Ctrl-C while the terminal is in raw mode.
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function api(path, { method = 'GET', body, jwt } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `JWT ${jwt}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Same mapping as create-baserow-table.mjs — the comments there explain why. */
function toBaserowField(name, spec) {
  const base = { name };

  switch (spec.type) {
    case 'text':
    case 'url':
      return { ...base, type: spec.type === 'url' ? 'url' : 'text' };
    case 'long_text':
      return { ...base, type: 'long_text' };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'number':
      return {
        ...base,
        type: 'number',
        number_decimal_places: spec.decimal_places ?? 0,
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
      if (spec.auto_now_add) {
        return { ...base, type: 'created_on', date_format: 'ISO', date_include_time: true };
      }
      if (spec.auto_now) {
        return { ...base, type: 'last_modified', date_format: 'ISO', date_include_time: true };
      }
      return { ...base, type: 'date', date_format: 'ISO' };
    case 'auto_number':
      // Baserow supplies the row id itself.
      return null;
    default:
      throw new Error(`unmapped field type "${spec.type}" on "${name}"`);
  }
}

function schemaOf(file) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8'));
}

async function signIn(password) {
  const { token, access_token } = await api('/api/user/token-auth/', {
    method: 'POST',
    body: { email: EMAIL, password }
  });
  return access_token ?? token;
}

async function createTable(jwt, schema) {
  const fields = Object.entries(schema.fields)
    .map(([name, spec]) => ({ name, payload: toBaserowField(name, spec) }))
    .filter(field => field.payload !== null);

  const primaryEntry = Object.entries(schema.fields).find(
    ([, spec]) => spec.primary && spec.type !== 'auto_number'
  );
  const primaryName = primaryEntry ? primaryEntry[0] : fields[0]?.name;

  const table = await api(`/api/database/tables/database/${DATABASE_ID}/`, {
    method: 'POST',
    jwt,
    body: { name: schema.table_name }
  });

  // A new table arrives with Name/Notes/Active and one blank row. The primary
  // cannot be deleted, so it is RENAMED into the schema's primary field.
  const existing = await api(`/api/database/fields/table/${table.id}/`, { jwt });
  const primaryField = existing.find(field => field.primary);
  const spare = existing.filter(field => !field.primary);

  await api(`/api/database/fields/${primaryField.id}/`, {
    method: 'PATCH',
    jwt,
    body: { name: primaryName, type: 'text' }
  });
  for (const field of spare) {
    await api(`/api/database/fields/${field.id}/`, { method: 'DELETE', jwt });
  }

  for (const field of fields) {
    if (field.name === primaryName) continue;
    await api(`/api/database/fields/table/${table.id}/`, {
      method: 'POST',
      jwt,
      body: field.payload
    });
  }

  // The blank row Baserow seeds would be a row belonging to nobody.
  const rows = await api(`/api/database/rows/table/${table.id}/?user_field_names=true`, { jwt });
  for (const row of rows.results ?? []) {
    await api(`/api/database/rows/table/${table.id}/${row.id}/`, { method: 'DELETE', jwt });
  }

  return table.id;
}

async function run() {
  console.log(`\n  ${APPLY ? 'APPLYING' : 'DRY RUN —'} Baserow setup`);
  console.log(`  ${BASE_URL}, database ${DATABASE_ID}, as ${EMAIL}\n`);

  const password = await resolvePassword();
  if (!password) {
    console.error('\n  No password given.\n');
    process.exit(1);
  }

  const jwt = await signIn(password);
  const tables = await api(`/api/database/tables/database/${DATABASE_ID}/`, { jwt });
  const byName = new Map(tables.map(table => [table.name, table.id]));

  const ids = {};
  let created = 0;

  console.log('  TABLES');
  for (const wanted of TABLES) {
    const schema = schemaOf(wanted.schema);
    const existingId = byName.get(schema.table_name);

    if (existingId) {
      ids[wanted.envKey] = existingId;
      console.log(`    ✓ ${schema.table_name.padEnd(22)} exists (id ${existingId})`);
      continue;
    }

    if (!APPLY) {
      console.log(`    + ${schema.table_name.padEnd(22)} would be created — ${wanted.feature}`);
      continue;
    }

    const id = await createTable(jwt, schema);
    ids[wanted.envKey] = id;
    created++;
    console.log(`    + ${schema.table_name.padEnd(22)} CREATED (id ${id})`);
  }

  console.log('\n  COLUMNS');
  let added = 0;
  for (const group of COLUMNS) {
    const schema = schemaOf(group.schema);
    const existing = await api(`/api/database/fields/table/${group.table}/`, { jwt });
    const have = new Set(existing.map(field => field.name));

    for (const name of group.fields) {
      if (have.has(name)) {
        console.log(`    ✓ ${schema.table_name}.${name} exists`);
        continue;
      }

      const payload = toBaserowField(name, schema.fields[name]);
      if (!APPLY) {
        console.log(`    + ${schema.table_name}.${name} would be added (${payload.type})`);
        continue;
      }

      await api(`/api/database/fields/table/${group.table}/`, { method: 'POST', jwt, body: payload });
      added++;
      console.log(`    + ${schema.table_name}.${name} ADDED (${payload.type})`);
    }
  }

  if (!APPLY) {
    console.log('\n  Nothing was written. Re-run with --apply.\n');
    return;
  }

  console.log(`\n  ${created} table(s) created, ${added} column(s) added.`);

  const lines = Object.entries(ids).map(([key, id]) => `      ${key}: ${id},`);
  if (lines.length === 0) return;

  if (!WRITE_ENV) {
    console.log('\n  Paste into environment.ts → baserow.tables:\n');
    console.log(lines.join('\n'));
    console.log('\n  Or re-run with --write-env to have it done for you.\n');
    return;
  }

  let source = readFileSync(ENVIRONMENT, 'utf8');
  let patched = 0;
  for (const [key, id] of Object.entries(ids)) {
    // Only ever rewrites `key: <number>` — comments and order are untouched.
    const pattern = new RegExp(`(\\b${key}:\\s*)\\d+`);
    if (pattern.test(source)) {
      source = source.replace(pattern, `$1${id}`);
      patched++;
    } else {
      console.error(`    ! ${key} not found in environment.ts — set it by hand`);
    }
  }
  writeFileSync(ENVIRONMENT, source);
  console.log(`\n  environment.ts updated (${patched} ids).\n`);
  console.log('  Run `npm run verify:fields` and restart the dev server.\n');
}

run().catch(error => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
