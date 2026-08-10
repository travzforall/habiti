#!/usr/bin/env node
/**
 * Adds a field to an existing Baserow table.
 *
 * The API token in src/environments/environment.ts is a *database token*: it
 * reads and writes rows and reads field definitions, but POST
 * /api/database/fields/... returns 401 for it. Creating a field needs a user
 * JWT, which means a real login — same constraint as create-baserow-table.mjs.
 *
 * WHY THIS EXISTS: tables 507 (projects) and 508 (tasks) have no `user_id`
 * column, so every row belongs to nobody. Until they do, per-user tasks and
 * projects cannot be stored server-side at all.
 *
 * Idempotent: a field that already exists is reported and skipped, so re-running
 * is safe.
 *
 * Usage:
 *   BASEROW_EMAIL=you@example.com BASEROW_PASSWORD=... \
 *     node scripts/add-baserow-field.mjs --table 508 --name user_id
 *
 *   # both tables at once, the actual reason this exists:
 *   BASEROW_EMAIL=... BASEROW_PASSWORD=... node scripts/add-baserow-field.mjs --preset user-scoping
 *
 * Options:
 *   --table <id>     Table to alter
 *   --name <name>    Field name (default: user_id)
 *   --type <type>    Baserow field type (default: text)
 *   --preset user-scoping   Adds user_id to tables 507 and 508
 *   --url <base>     Overrides the Baserow host
 *   --email <addr>   Baserow login email (or BASEROW_EMAIL)
 *   --password-stdin Read the password from stdin — the shell never sees it,
 *                    so characters like $ ! ` cannot be expanded away
 *   --password-file <path>  Read the password from a file
 *   --check-login    Try the login only, change nothing
 *   --dry-run        Report what would change; send nothing
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '../src/environments/environment.ts');

/**
 * Flags that take NO value.
 *
 * Declared here, above the parseArgs() call below, because `const` is not
 * hoisted the way a function declaration is — defining it further down the file
 * threw "Cannot access 'BOOLEAN_FLAGS' before initialization" at startup.
 *
 * Without this list, `--password-stdin` swallowed whatever followed it, so a
 * stray word became the "password" and produced a 401 that looked exactly like
 * wrong credentials.
 */
const BOOLEAN_FLAGS = new Set(['dry-run', 'password-stdin', 'check-login']);

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url || hostFromEnvironment() || 'https://db.jollycares.com';
const email = args.email || process.env.BASEROW_EMAIL;
const password = readPassword();
const dryRun = !!args['dry-run'];

/** Tables that need a user_id before their rows can belong to anyone. */
const PRESETS = {
  'user-scoping': [
    { table: 507, name: 'user_id', type: 'text', label: 'projects' },
    { table: 508, name: 'user_id', type: 'text', label: 'tasks' }
  ]
};

const jobs = args.preset
  ? PRESETS[args.preset]
  : [{ table: Number(args.table), name: args.name || 'user_id', type: args.type || 'text' }];

// --check-login touches no table, so it must not require one — being told to
// "pass --table" while trying to diagnose a login is a dead end.
if (!args['check-login'] && (!jobs || jobs.some(j => !Number.isFinite(j.table)))) {
  console.error('Pass --table <id>, or --preset user-scoping. See the header of this file.');
  process.exit(1);
}

if ((!dryRun || args['check-login']) && (!email || !password)) {
  console.error('An email and password are required (a database token cannot create fields).');
  console.error('');
  console.error('  Safest, because the shell never sees the password:');
  console.error('    node scripts/add-baserow-field.mjs --preset user-scoping \\');
  console.error('      --email you@example.com --password-stdin');
  console.error('');
  console.error('  Add --dry-run to see what would change without signing in.');
  process.exit(1);
}

(async () => {
  if (args['check-login']) {
    await login();
    console.log('  ✓ login OK — the credentials work. Re-run without --check-login to apply.\n');
    return;
  }

  const jwt = dryRun ? null : await login();

  for (const job of jobs) {
    const label = job.label ? `${job.table} (${job.label})` : String(job.table);
    const existing = await fields(job.table, jwt);

    if (existing === null) {
      console.log(`  ✗ table ${label}: could not read fields`);
      continue;
    }

    if (existing.some(f => f.name === job.name)) {
      console.log(`  = table ${label}: "${job.name}" already exists`);
      continue;
    }

    if (dryRun) {
      console.log(`  + table ${label}: would add "${job.name}" (${job.type})`);
      continue;
    }

    const created = await api(`/api/database/fields/table/${job.table}/`, {
      method: 'POST',
      jwt,
      body: { name: job.name, type: job.type }
    });
    console.log(`  ✓ table ${label}: added "${created.name}" (id ${created.id})`);
  }

  console.log('');
  if (dryRun) console.log('  Dry run — nothing was sent.\n');
})().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

async function login() {
  try {
    const auth = await api('/api/user/token-auth/', {
      method: 'POST',
      body: { email, password }
    });
    const jwt = auth.token ?? auth.access_token;
    if (!jwt) throw new Error('Login succeeded but returned no token.');
    return jwt;
  } catch (err) {
    if (!String(err.message).includes('401')) throw err;

    /**
     * A 401 here is almost never a genuinely wrong password.
     *
     * Passing a password inline lets the SHELL expand it first: `$`, `!`,
     * backticks and quotes are all eaten before the script runs, so Baserow
     * receives something shorter than what was typed. Reporting the length —
     * never the value — is what makes that visible.
     */
    console.error('\n  Baserow rejected the credentials.\n');
    console.error(`  host           ${baseUrl}`);
    console.error(`  email          ${email || '(not set)'}`);
    console.error(`  password       ${describePassword(password)}`);
    console.error('');
    console.error('  If that length is not what you typed, your shell ate part of it.');
    console.error('  Pass it without the shell touching it:');
    console.error('');
    console.error(`    node scripts/add-baserow-field.mjs --preset user-scoping \\`);
    console.error(`      --email ${email || 'you@example.com'} --password-stdin`);
    console.error('');
    console.error('  ...then type the password at the prompt and press Ctrl-D.');
    console.error('');
    console.error('  Otherwise check: is this the email you sign in to Baserow with,');
    console.error(`  and is ${baseUrl} the instance that account belongs to?`);
    throw new Error('login failed');
  }
}

/**
 * Reads the password without the shell in the way.
 *
 * --password-stdin is the safe path: nothing between the keyboard and here.
 */
function readPassword() {
  if (args['password-stdin']) {
    try {
      return fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
    } catch {
      return '';
    }
  }
  if (args['password-file']) {
    try {
      return fs.readFileSync(args['password-file'], 'utf8').replace(/\r?\n$/, '');
    } catch {
      console.error(`Could not read ${args['password-file']}`);
      process.exit(1);
    }
  }
  return process.env.BASEROW_PASSWORD || '';
}

/** Length and shape only — never the value, which would end up in shell history. */
function describePassword(value) {
  if (!value) return '(empty)';
  const risky = [...new Set(value.match(/[$!`\\"']/g) || [])];
  return (
    `${value.length} characters` +
    (risky.length ? `, contains ${risky.map(c => `"${c}"`).join(' ')} — the shell expands these` : '')
  );
}

/** Field definitions are readable with the database token, so dry runs work signed out. */
async function fields(tableId, jwt) {
  try {
    return await api(`/api/database/fields/table/${tableId}/`, {
      jwt,
      token: jwt ? undefined : tokenFromEnvironment()
    });
  } catch {
    return null;
  }
}

async function api(pathname, { method = 'GET', body, jwt, token } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `JWT ${jwt}` } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${pathname} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function hostFromEnvironment() {
  const match = readEnv(/apiUrl:\s*'(https?:\/\/[^/]+)/);
  return match || null;
}

function tokenFromEnvironment() {
  return readEnv(/token:\s*'([^']+)'/);
}

function readEnv(pattern) {
  try {
    const found = fs.readFileSync(envPath, 'utf8').match(pattern);
    return found ? found[1] : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);

    if (BOOLEAN_FLAGS.has(key)) {
      out[key] = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
