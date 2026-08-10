#!/usr/bin/env node
/**
 * Reassigns the seeded sample rows to a real account.
 *
 * WHY THIS EXISTS
 *
 * Every per-user read was built as `filter__field_<name>__<op>`. That prefix is
 * only valid for numeric field ids, and Baserow ignores a filter parameter it
 * does not recognise — so the "filtered" queries returned the whole table and
 * the app rendered results[0]. Every account therefore saw user_001's data:
 * level 5, 450 points, an 8-day streak, ten habits.
 *
 * With the filters fixed, those rows belong to nobody real and the app
 * correctly shows an empty account. This script hands them to a real user id
 * so a populated app can be used for testing instead of starting from scratch.
 *
 * IT REWRITES ROWS IN A LIVE DATABASE. Dry-run is the default and prints every
 * change; --apply is required to send anything.
 *
 * Usage:
 *   node claim-sample-data.js --user 6                    # dry run
 *   node claim-sample-data.js --user 6 --apply
 *   node claim-sample-data.js --user 6 --from user_002 --apply
 *
 * Options:
 *   --user <id>      Xano user id to hand the rows to (required)
 *   --from <id>      Which seed owner to take. Default: user_001
 *   --tables <list>  Comma-separated table ids. Default: 521,522,524,525
 *   --token <token>  Overrides the token read from environment.ts
 *   --url <base>     Overrides the API base URL
 *   --apply          Actually write. Without it, nothing is sent.
 *
 * Find your user id in the browser console while signed in:
 *   JSON.parse(localStorage.getItem('current_user')).id
 */

const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));
const envPath = path.resolve(__dirname, '../../src/environments/environment.ts');
const token = args.token || readFromEnv(/token:\s*'([^']+)'/);
const baseUrl = args.url || readFromEnv(/apiUrl:\s*'([^']+rows\/table)'/);

const DEFAULT_TABLES = [
  { id: 521, name: 'habits' },
  { id: 522, name: 'habit entries' },
  { id: 524, name: 'game state' },
  { id: 525, name: 'user achievements' }
];

if (!token || !baseUrl) {
  console.error('Could not read the Baserow token/apiUrl from environment.ts. Pass --token/--url.');
  process.exit(1);
}

const targetUser = args.user;
if (!targetUser) {
  console.error('--user <id> is required. See the header of this file for how to find it.');
  process.exit(1);
}

// A Xano id is numeric; a seed owner looks like "user_001". Claiming data FOR a
// seed id would leave the app exactly as broken as before, so refuse it.
if (!/^\d+$/.test(String(targetUser))) {
  console.error(`--user must be a numeric Xano id, got "${targetUser}".`);
  console.error('A value like "user_001" or "default" is seed data, not a real account.');
  process.exit(1);
}

const fromUser = args.from || 'user_001';
const tables = args.tables
  ? String(args.tables)
      .split(',')
      .map(id => ({ id: Number(id.trim()), name: `table ${id.trim()}` }))
  : DEFAULT_TABLES;

const headers = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };
const apply = !!args.apply;

(async () => {
  console.log(`\n${apply ? 'CLAIMING' : 'DRY RUN —'} rows owned by "${fromUser}" for user ${targetUser}\n`);

  let total = 0;
  let written = 0;

  for (const table of tables) {
    const rows = await listRows(table.id);
    // 'default' is included on purpose: it is what the pre-fix code wrote when
    // it could not resolve a user, so those rows are orphaned in the same way.
    const mine = rows.filter(r => {
      const owner = String(r.user_id ?? '');
      return owner === fromUser || owner === 'default';
    });

    const already = rows.filter(r => String(r.user_id ?? '') === String(targetUser)).length;
    console.log(`  ${table.name} (${table.id}): ${rows.length} rows, ${mine.length} to claim, ${already} already yours`);

    total += mine.length;
    if (mine.length === 0) continue;

    for (const row of mine) {
      const label = row.name || row.title || row.habit_id || `row ${row.id}`;
      if (!apply) {
        console.log(`      would set user_id ${String(row.user_id)} -> ${targetUser}  (${label})`);
        continue;
      }
      await patchRow(table.id, row.id, { user_id: String(targetUser) });
      written++;
      console.log(`      ✓ ${label}`);
    }
  }

  console.log('');
  if (!apply) {
    console.log(`  ${total} rows would change. Re-run with --apply to write them.\n`);
  } else {
    console.log(`  ${written} rows updated. Reload the app.\n`);
  }
})().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

async function listRows(tableId) {
  const out = [];
  let page = 1;
  for (;;) {
    const url = `${baseUrl}/${tableId}/?user_field_names=true&size=200&page=${page}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GET table ${tableId} -> ${response.status}. Check the id and the token's access.`);
    }
    const body = await response.json();
    out.push(...(body.results || []));
    if (!body.next) return out;
    page++;
  }
}

async function patchRow(tableId, rowId, data) {
  const url = `${baseUrl}/${tableId}/${rowId}/?user_field_names=true`;
  const response = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(data) });
  if (!response.ok) {
    throw new Error(`PATCH ${tableId}/${rowId} -> ${response.status} ${await response.text()}`);
  }
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
