#!/usr/bin/env node
/**
 * Source-integrity checks for the legal documents. Two of them.
 *
 * ── 1. THE REGISTRY MUST NOT IMPORT THE PROSE ────────────────────────────
 * registry.ts is eager: registration, the re-acceptance check and the footer
 * links all read it. documents/ holds every word of every document. If the
 * first ever imports the second, all of it lands in the initial bundle — the
 * leak the habit library (+137 kB) and the skill catalogue (+120 kB) each
 * caused once before, against ~43 kB of remaining headroom.
 *
 * A typecheck cannot see the difference. This is checked here rather than in a
 * Karma spec because it is a fact about the SOURCE FILE, and the Angular Karma
 * builder bundles rather than serving raw .ts — a browser test cannot read it.
 *
 * ── 2. EVERY DOCUMENT'S CONTENT HASH MUST MATCH ITS TEXT ─────────────────
 *
 * WHY A HASH AT ALL
 * An acceptance record has to identify WHICH TEXT was accepted. A version
 * number alone does not: if anyone edits v1 after someone accepted it, the
 * record silently starts pointing at different words. The hash is what makes
 * "you accepted this exact text" checkable, and it mirrors `accepted_rules_hash`
 * in database-schemas/17-campaign-participants.json.
 *
 * WHY IT IS A CHECKED-IN CONSTANT RATHER THAN COMPUTED AT RUNTIME
 * Unlike campaign rules — where two clients must independently agree on a hash —
 * nothing in the app ever needs to compute one. Keeping it a constant means no
 * sha256 implementation ships in the bundle, and legal-documents.spec.ts
 * recomputes it in CI, so editing a word without bumping the hash fails the
 * build rather than going unnoticed.
 *
 * Usage:
 *   node scripts/check-legal.mjs           # report; exits 1 if anything is wrong
 *   node scripts/check-legal.mjs --write   # rewrite the hash constants in place
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENTS_DIR = join(ROOT, 'apps/habiti/src/app/config/legal/documents');
const REGISTRY = join(ROOT, 'apps/habiti/src/app/config/legal/registry.ts');
const WRITE = process.argv.includes('--write');

/**
 * Must stay byte-identical in behaviour to canonicalJson() in
 * libs/shared/util. Keys sorted, ARRAY ORDER PRESERVED — reordering two clauses
 * is a real change and must produce a different hash.
 */
function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    out[key] = canonicalise(value[key]);
  }
  return out;
}

const hashOf = blocks => createHash('sha256').update(JSON.stringify(canonicalise(blocks))).digest('hex');

/**
 * Extracts the `blocks` array from a document file without executing it.
 *
 * The files are TypeScript, so they cannot simply be imported here. Rather than
 * add a transpiler to a script, the blocks array is sliced out textually and
 * evaluated as a JS literal — these files are ours, code-reviewed, and contain
 * data only.
 */
function blocksOf(source, file) {
  const start = source.indexOf('blocks: [');
  if (start === -1) throw new Error(`${file}: no blocks array found`);

  let depth = 0;
  let i = source.indexOf('[', start);
  const from = i;
  for (; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`${file}: unbalanced blocks array`);

  const literal = source.slice(from, i + 1);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${literal};`)();
}

// --- 1. registry isolation -------------------------------------------------
{
  const source = readFileSync(REGISTRY, 'utf8');
  const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]);
  const offending = imports.filter(spec => spec.includes('documents'));

  if (offending.length > 0) {
    console.error(
      `\n  registry.ts imports ${offending.join(', ')}.\n\n` +
        `  That puts every legal document into the INITIAL bundle. registry.ts is\n` +
        `  read by registration and the footer links, which are eager; the prose is\n` +
        `  only needed by the lazily-routed legal page.\n\n` +
        `  Put whatever the eager path needs into LEGAL_INDEX instead.\n`
    );
    process.exit(1);
  }
  console.log(`  ok    registry.ts imports only: ${imports.join(', ') || '(nothing)'}`);
}

// --- 2. content hashes -----------------------------------------------------
const files = readdirSync(DOCUMENTS_DIR)
  .filter(name => /\.v\d+\.ts$/.test(name))
  .sort();

if (files.length === 0) {
  console.error(`\n  No document versions found in ${DOCUMENTS_DIR}\n`);
  process.exit(1);
}

let stale = 0;
const computed = new Map();

for (const file of files) {
  const path = join(DOCUMENTS_DIR, file);
  const source = readFileSync(path, 'utf8');
  const hash = hashOf(blocksOf(source, file));

  const idMatch = source.match(/^\s*id:\s*'([^']+)'/m);
  const versionMatch = source.match(/^\s*version:\s*(\d+)/m);
  const currentMatch = source.match(/^\s*contentHash:\s*'([^']*)'/m);
  if (!idMatch || !versionMatch) throw new Error(`${file}: missing id or version`);

  const current = currentMatch ? currentMatch[1] : '';
  const ok = current === hash;
  if (!ok) stale++;
  computed.set(`${idMatch[1]}@${versionMatch[1]}`, hash);

  console.log(`  ${ok ? 'ok  ' : 'STALE'}  ${file.padEnd(26)} ${hash.slice(0, 16)}…`);

  if (WRITE && !ok) {
    writeFileSync(path, source.replace(/(\n\s*contentHash:\s*')[^']*(')/, `$1${hash}$2`));
  }
}

// The registry duplicates the hash of each document's CURRENT version so it can
// stay prose-free. Keep it in step.
let registry = readFileSync(REGISTRY, 'utf8');
const latest = new Map();
for (const [key, hash] of computed) {
  const [id, version] = key.split('@');
  const prev = latest.get(id);
  if (!prev || Number(version) > prev.version) latest.set(id, { version: Number(version), hash });
}

for (const [id, { hash }] of latest) {
  const pattern = new RegExp(`(['"]?${id}['"]?:\\s*\\{[^}]*?contentHash:\\s*')[^']*(')`, 's');
  const found = registry.match(pattern);
  if (!found) {
    console.error(`\n  registry.ts has no entry for "${id}"\n`);
    process.exit(1);
  }
  if (found[0].includes(hash)) continue;
  stale++;
  console.log(`  STALE  registry.${id}`);
  if (WRITE) registry = registry.replace(pattern, `$1${hash}$2`);
}
if (WRITE) writeFileSync(REGISTRY, registry);

console.log('');
if (stale > 0 && !WRITE) {
  console.error(
    `  ${stale} hash(es) out of date. A document changed without its hash being\n` +
      `  updated, which would make every acceptance record point at the wrong text.\n\n` +
      `  Run: node scripts/legal-hashes.mjs --write\n`
  );
  process.exit(1);
}
console.log(WRITE ? '  Hashes written.\n' : '  All hashes current.\n');
