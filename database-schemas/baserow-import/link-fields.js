#!/usr/bin/env node
/**
 * Creates the link (foreign key) fields between the campaign tables and fills
 * them in — the step create-tables.js deliberately skips.
 *
 * WHY IT IS SEPARATE: a link field needs its target table to already exist, so
 * it cannot be created while the tables are still being made. Once they all
 * exist, this is safe to run.
 *
 * WHAT A LINK FIELD IS: the child tables carry a `campaign_key` TEXT column
 * holding e.g. "cmp_active_05". That is just a string — Baserow does not know
 * it points anywhere. This creates a real relation alongside it, so you can
 * click through in the UI and the app's link_row_has filter works. The text
 * column stays, deliberately: the client filters on it when it does not yet
 * know the parent's numeric row id.
 *
 * Table ids are read from src/environments/environment.ts (baserow.tables), so
 * fill those in first.
 *
 *   export BASEROW_EMAIL='you@example.com'
 *   export BASEROW_PASSWORD='...'
 *   node link-fields.js --dry-run
 *   node link-fields.js
 *
 * Safe to re-run: an existing link field is reused rather than duplicated, and
 * rows that already point at the right parent are left alone.
 */

const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));
const BASE = (args.url || 'https://db.jollycares.com').replace(/\/$/, '');
const DRY = !!args['dry-run'];
const envPath = path.resolve(__dirname, '../../src/environments/environment.ts');

/**
 * Each link, and how a child row finds its parent.
 *
 * `match` lists the columns that together identify the parent. campaign_key
 * alone identifies a campaign; a participant or pledge needs the user too,
 * since one campaign has several.
 */
const LINKS = [
  { child: 'campaignParticipants', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] },
  { child: 'campaignRuleVersions', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] },
  { child: 'campaignReports', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] },
  { child: 'campaignReports', field: 'participant_id', parent: 'campaignParticipants', match: ['campaign_key', 'user_id'] },
  { child: 'campaignPledges', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] },
  { child: 'campaignPledges', field: 'participant_id', parent: 'campaignParticipants', match: ['campaign_key', 'user_id'] },
  { child: 'campaignSettlements', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] },
  { child: 'campaignSettlements', field: 'pledge_id', parent: 'campaignPledges', match: ['campaign_key', 'debtor_user_id:user_id'] },
  { child: 'campaignEvents', field: 'campaign_id', parent: 'campaigns', match: ['campaign_key'] }
];

main().catch(err => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});

async function main() {
  const tables = readTableIds();
  const token = readFromEnv(/token:\s*'([^']+)'/);

  const missing = [...new Set(LINKS.flatMap(l => [l.child, l.parent]))].filter(k => !tables[k]);
  if (missing.length) {
    throw new Error(
      `These tables have no id in environment.ts yet: ${missing.join(', ')}\n` +
        'Create them with create-tables.js and paste the ids in first.'
    );
  }

  console.log(`Instance : ${BASE}`);
  for (const [name, id] of Object.entries(tables)) console.log(`  ${name.padEnd(22)} ${id}`);
  console.log('');

  if (DRY) {
    for (const link of LINKS) {
      console.log(
        `${link.child}.${link.field} → ${link.parent}   (matched on ${link.match.join(' + ')})`
      );
    }
    console.log('\nDry run — nothing created or changed.');
    return;
  }

  const jwt = await login();
  const jwtHeaders = { Authorization: `JWT ${jwt}`, 'Content-Type': 'application/json' };
  const tokenHeaders = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };

  for (const link of LINKS) {
    const childId = tables[link.child];
    const parentId = tables[link.parent];

    // 1. Create the link field, unless it is already there.
    const existing = await getJson(`${BASE}/api/database/fields/table/${childId}/`, jwtHeaders);
    let field = existing.find(f => f.name === link.field);

    if (field && field.type !== 'link_row') {
      console.log(`⚠ ${link.child}.${link.field} exists but is '${field.type}', not a link — skipped`);
      continue;
    }

    if (!field) {
      const res = await fetch(`${BASE}/api/database/fields/table/${childId}/`, {
        method: 'POST',
        headers: jwtHeaders,
        body: JSON.stringify({
          name: link.field,
          type: 'link_row',
          link_row_table_id: parentId
        })
      });
      if (!res.ok) {
        console.log(`✗ ${link.child}.${link.field}: HTTP ${res.status} ${await res.text()}`);
        continue;
      }
      field = await res.json();
      console.log(`✓ created ${link.child}.${link.field} → ${link.parent}`);
    } else {
      console.log(`· ${link.child}.${link.field} already exists`);
    }

    // 2. Fill it in by matching the text columns.
    const parents = await allRows(`${BASE}/api/database/rows/table/${parentId}/`, tokenHeaders);
    const children = await allRows(`${BASE}/api/database/rows/table/${childId}/`, tokenHeaders);

    const index = new Map();
    for (const parent of parents) index.set(keyOf(parent, link.match, 'parent'), parent.id);

    const updates = [];
    let unmatched = 0;

    for (const child of children) {
      const parentRowId = index.get(keyOf(child, link.match, 'child'));
      if (!parentRowId) {
        unmatched++;
        continue;
      }
      const current = (child[link.field] || []).map(v => v.id);
      if (current.length === 1 && current[0] === parentRowId) continue;
      updates.push({ id: child.id, [link.field]: [parentRowId] });
    }

    if (updates.length) {
      const res = await fetch(
        `${BASE}/api/database/rows/table/${childId}/batch/?user_field_names=true`,
        { method: 'PATCH', headers: tokenHeaders, body: JSON.stringify({ items: updates }) }
      );
      if (!res.ok) {
        console.log(`  ✗ linking rows failed: HTTP ${res.status} ${await res.text()}`);
        continue;
      }
    }

    console.log(
      `  linked ${updates.length} row(s)` +
        (unmatched ? `, ${unmatched} with no matching parent` : '') +
        (!updates.length && !unmatched ? ' — already up to date' : '')
    );
  }

  console.log('\nDone. The text keys (campaign_key etc.) are kept on purpose — the app filters on them.');
}

/** Builds a comparison key. 'a:b' means the child column a maps to the parent column b. */
function keyOf(row, match, side) {
  return match
    .map(spec => {
      const [childCol, parentCol] = spec.split(':');
      const col = side === 'child' ? childCol : parentCol || childCol;
      const value = row[col];
      // Single-selects come back as objects; the text is what we compare.
      return value && typeof value === 'object' ? value.value : value;
    })
    .join('|');
}

async function allRows(url, headers) {
  const out = [];
  for (let page = 1; ; page++) {
    const body = await getJson(`${url}?user_field_names=true&size=200&page=${page}`, headers);
    out.push(...(body.results || []));
    if (!body.next) return out;
  }
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed (HTTP ${res.status})`);
  return res.json();
}

function readTableIds() {
  const src = fs.readFileSync(envPath, 'utf8');
  const block = src.match(/tables:\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error('Could not find baserow.tables in environment.ts');

  const ids = {};
  for (const [, key, value] of block[1].matchAll(/(\w+):\s*(\d+)/g)) {
    if (Number(value) > 0) ids[key] = Number(value);
  }
  return ids;
}

function readFromEnv(pattern) {
  const match = fs.readFileSync(envPath, 'utf8').match(pattern);
  if (!match) throw new Error('Could not read the Baserow token from environment.ts');
  return match[1];
}

async function login() {
  const email = process.env.BASEROW_EMAIL;
  const password = process.env.BASEROW_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set BASEROW_EMAIL and BASEROW_PASSWORD. Creating a field needs a JWT;\n' +
        'the database token in environment.ts cannot do it.'
    );
  }

  const res = await fetch(`${BASE}/api/user/token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login failed (HTTP ${res.status}).`);

  const body = await res.json();
  const jwt = body.access_token || body.token;
  if (!jwt) throw new Error('Login succeeded but no token was returned.');
  console.log(`✓ Logged in as ${email}\n`);
  return jwt;
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
