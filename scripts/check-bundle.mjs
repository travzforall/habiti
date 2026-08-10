#!/usr/bin/env node
/**
 * Fails the build when the INITIAL bundle grows past its budget.
 *
 * WHY THIS EXISTS
 * Angular's own budgets already check this, but a budget warning during the
 * build scrolls past in CI without failing anything. This file also prints the
 * number, so a review sees "755 kB -> 880 kB" rather than just a crossed
 * threshold, and prints the biggest contributors so the cause is one line away.
 *
 * The failure mode it guards is specific and has happened twice here: a bundled
 * catalogue (the habit library, the skill catalogue) gets imported by something
 * on the eager path and silently adds ~120 kB to what every user downloads
 * before the app renders. Unit tests stay green throughout. During a directory
 * restructure, where import paths change wholesale, nothing else catches it.
 *
 * HOW "INITIAL" IS MEASURED
 * By walking the STATIC import graph from the entry scripts.
 *
 * Reading only index.html is not enough and was the first version of this
 * script: Angular emits <link rel=modulepreload> for a subset of the initial
 * chunks, so that undercounted 757 kB as 291 kB — and a catalogue landing in a
 * transitively-imported chunk would have been invisible, which is the one thing
 * this exists to see.
 *
 * esbuild's output distinguishes the two cases unambiguously:
 *     from"./chunk-X.js"    / import"./chunk-X.js"    static  -> initial, followed
 *     import("./chunk-X.js")                          dynamic -> lazy, not followed
 * So a page moved behind a lazy route shows up here as a drop, which is exactly
 * the behaviour you want when someone fixes a leak.
 *
 * Stylesheets linked from index.html count too — Angular includes them in its
 * own "Initial total", and 70 kB of CSS is 70 kB the user waits for.
 *
 * kB here means 1000 bytes, NOT 1024, to match the figure `ng build` prints.
 * The two differ by 2.4%, which is easily half a budget's headroom and a very
 * annoying thing to rediscover while comparing two numbers that should agree.
 *
 * Usage: node scripts/check-bundle.mjs [--budget-kb 800] [--dir dist/habiti/browser]
 */

import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const dir = args.get('dir') ?? 'dist/habiti/browser';
const budgetKb = Number(args.get('budget-kb') ?? 800);

const indexPath = join(dir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`\n  No index.html in ${dir} — run the production build first.\n`);
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');

// The entry points: <script src>. modulepreload hrefs are a subset of what the
// walk below finds anyway, so they are not needed as separate roots.
const entries = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1]);

if (entries.length === 0) {
  console.error(`\n  index.html in ${dir} has no <script src> — that cannot be right.\n`);
  process.exit(1);
}

/**
 * Static imports only.
 *
 * `import"./x.js"` and `from"./x.js"` are static. `import("./x.js")` is
 * dynamic, and does not match either alternative because of the paren — which
 * is the whole distinction between what ships up front and what does not.
 */
const STATIC_IMPORT = /(?:\bfrom|\bimport)"(\.\/[^"]+\.js)"/g;

const seen = new Set();
const queue = [...entries];

while (queue.length > 0) {
  const file = queue.shift();
  if (seen.has(file)) continue;

  const path = join(dir, file);
  if (!existsSync(path)) {
    console.error(`\n  ${file} is referenced but missing from ${dir}.\n`);
    process.exit(1);
  }
  seen.add(file);

  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(STATIC_IMPORT)) {
    queue.push(match[1].replace(/^\.\//, ''));
  }
}

// Stylesheets are initial by definition — the browser blocks render on them.
for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)) {
  seen.add(match[1]);
}

const rows = [...seen]
  .map(file => ({ file, bytes: statSync(join(dir, file)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const total = rows.reduce((sum, row) => sum + row.bytes, 0);
const KB = 1000;
const totalKb = total / KB;

console.log(`\n  Initial bundle — ${rows.length} files, budget ${budgetKb} kB\n`);
for (const { file, bytes } of rows.slice(0, 10)) {
  console.log(`    ${(bytes / KB).toFixed(1).padStart(8)} kB  ${file}`);
}
if (rows.length > 10) console.log(`${' '.repeat(14)}      … ${rows.length - 10} more`);
console.log(`\n    ${totalKb.toFixed(2).padStart(8)} kB  TOTAL\n`);

if (totalKb > budgetKb) {
  console.error(
    `  FAIL: initial bundle is ${totalKb.toFixed(2)} kB, ` +
      `${(totalKb - budgetKb).toFixed(2)} kB over the ${budgetKb} kB budget.\n\n` +
      `  Usually this means something on the eager path imported a bundled\n` +
      `  catalogue. Check what changed its imports, and consider @defer or\n` +
      `  moving the consumer behind a lazy route.\n`
  );
  process.exit(1);
}

console.log(`  OK: ${(budgetKb - totalKb).toFixed(2)} kB of headroom.\n`);
