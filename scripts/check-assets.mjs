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
 * Usage: node scripts/check-assets.mjs [--dir dist/habiti/browser]
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}
const dir = args.get('dir') ?? 'dist/habiti/browser';

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

console.log('');
if (failed) {
  console.error('  FAIL: the publish directory is incomplete.\n');
  process.exit(1);
}
console.log('  OK: publish directory looks deployable.\n');
