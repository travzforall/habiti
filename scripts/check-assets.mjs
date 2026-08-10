#!/usr/bin/env node
/**
 * Asserts the deployable artifacts are actually in the publish directory.
 *
 * WHY THIS EXISTS
 * Every check here guards a failure that produces a GREEN build and a broken
 * site:
 *
 *   _redirects   missing => every deep link 404s on Netlify. The app works
 *                perfectly if you always enter through "/", which is exactly
 *                how it gets tested by hand and why this ships unnoticed.
 *   rive/*.wasm  missing => the animation silently never plays. It is copied by
 *                an asset glob pointing into node_modules, which is the kind of
 *                path that breaks when a project moves.
 *   index.html   missing => the build output went somewhere else entirely,
 *                usually because outputPath and the publish directory drifted.
 *
 * None of these are unit-testable and none of them fail the build. Directory
 * restructures break build configuration, not application logic, which is what
 * makes a file-existence check worth its two dozen lines during a migration.
 *
 * IT ALSO CHECKS THAT THE STYLESHEET IS NOT TINY, which sounds arbitrary and is
 * not. Moving the app to apps/habiti left Tailwind's `content` glob pointing at
 * the old ./src, so it matched no files and emitted a stylesheet with no
 * utility classes: 70.16 kB became 4.64 kB, the build stayed green, all 640
 * tests passed, and every page would have rendered unstyled.
 *
 * The bundle-size gate cannot catch that, because the bundle got SMALLER — a
 * budget reads a catastrophic regression as a 66 kB improvement. A floor is the
 * only cheap check that points the right way.
 *
 * Usage: node scripts/check-assets.mjs [--dir dist/habiti/browser] [--min-css-kb 40]
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}
const dir = args.get('dir') ?? 'dist/habiti/browser';
const minCssKb = Number(args.get('min-css-kb') ?? 40);

/** [label, path relative to dir, why it matters when absent] */
const REQUIRED = [
  ['index.html', 'index.html', 'the build output is not where the publish directory expects it'],
  ['_redirects', '_redirects', 'SPA deep links will 404 — only "/" would work'],
  ['rive wasm', 'rive/rive.wasm', 'the Rive animation silently never plays']
];

let failed = false;
console.log(`\n  Publish directory: ${dir}\n`);

if (!existsSync(dir)) {
  console.error(`  FAIL: ${dir} does not exist — run the production build first.\n`);
  process.exit(1);
}

for (const [label, path, consequence] of REQUIRED) {
  if (existsSync(join(dir, path))) {
    console.log(`    ok    ${label}`);
  } else {
    failed = true;
    console.error(`    MISS  ${label}  (${path}) — ${consequence}`);
  }
}

// A publish directory with no JS is a build that produced nothing useful.
const scripts = readdirSync(dir).filter(name => name.endsWith('.js'));
if (scripts.length === 0) {
  failed = true;
  console.error('    MISS  no .js files at all — the build emitted nothing');
} else {
  console.log(`    ok    ${scripts.length} script files`);
}

/**
 * The stylesheet must not be suspiciously small.
 *
 * A Tailwind `content` glob that matches nothing still produces a valid,
 * tiny stylesheet — no error, no warning, just an unstyled app. Since that
 * makes the bundle smaller, the size budget cannot see it.
 */
const stylesheets = readdirSync(dir).filter(name => name.endsWith('.css'));
if (stylesheets.length === 0) {
  failed = true;
  console.error('    MISS  no .css files — the stylesheet was not emitted');
} else {
  const largestKb =
    Math.max(...stylesheets.map(name => statSync(join(dir, name)).size)) / 1000;
  if (largestKb < minCssKb) {
    failed = true;
    console.error(
      `    THIN  largest stylesheet is ${largestKb.toFixed(1)} kB, under the ` +
        `${minCssKb} kB floor — Tailwind almost certainly purged everything, ` +
        `which means its content glob no longer matches the source`
    );
  } else {
    console.log(`    ok    stylesheet ${largestKb.toFixed(1)} kB (floor ${minCssKb} kB)`);
  }
}

console.log('');
if (failed) {
  console.error('  FAIL: the publish directory is incomplete.\n');
  process.exit(1);
}
console.log('  OK: publish directory looks deployable.\n');
