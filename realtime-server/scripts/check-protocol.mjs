#!/usr/bin/env node
/**
 * Fails if the wire contract has drifted between the app and the relay.
 *
 * The two copies exist because the relay is a separate package with its own
 * tsconfig — it cannot import from src/app. This script is what keeps
 * "duplicated on purpose" from quietly becoming "duplicated and wrong": a kind
 * added on one side but not the other would be silently dropped by
 * isPublishFrame at runtime, with no error anywhere.
 *
 * Run: node scripts/check-protocol.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = {
  app: resolve(here, '../../src/app/models/realtime.models.ts'),
  relay: resolve(here, '../src/protocol.ts')
};

/** Compares meaning, not formatting: comments and blank lines are noise here. */
function section(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`cannot read ${path}`);
  }

  const start = text.indexOf('// <protocol>');
  const end = text.indexOf('// </protocol>');
  if (start === -1 || end === -1 || end < start) {
    fail(`${path} is missing its // <protocol> … // </protocol> markers`);
  }

  return text
    .slice(start + '// <protocol>'.length, end)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    .join('\n');
}

function fail(message) {
  console.error(`✗ protocol check: ${message}`);
  process.exit(1);
}

const app = section(files.app);
const relay = section(files.relay);

if (app !== relay) {
  const a = app.split('\n');
  const b = relay.split('\n');
  const at = a.findIndex((line, i) => line !== b[i]);
  console.error('✗ protocol check: the app and relay contracts have drifted.\n');
  console.error(`  first difference at line ${at + 1} of the <protocol> block:`);
  console.error(`    app:   ${a[at] ?? '(end of block)'}`);
  console.error(`    relay: ${b[at] ?? '(end of block)'}\n`);
  console.error('  Copy the block from src/app/models/realtime.models.ts into');
  console.error('  realtime-server/src/protocol.ts (or the reverse) and re-run.');
  process.exit(1);
}

/**
 * Second check, and the one more likely to fire.
 *
 * protocol.ts declares the kinds and scopes TWICE: once as a type union inside
 * the markers, once as a runtime Set outside them (types vanish at runtime, so
 * validation needs real values). Add a kind to the union only and
 * isPublishFrame rejects it — the publish is dropped in silence, with a green
 * typecheck and no error on either side.
 */
const relayText = readFileSync(files.relay, 'utf8');

function unionMembers(name) {
  const match = relayText.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  if (!match) fail(`cannot find "export type ${name}" in protocol.ts`);
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
}

function setMembers(name) {
  const match = relayText.match(new RegExp(`const ${name} = new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!match) fail(`cannot find "const ${name} = new Set" in protocol.ts`);
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
}

let drifted = false;
for (const [typeName, setName] of [
  ['RelayEventKind', 'KINDS'],
  ['RefreshScope', 'SCOPES']
]) {
  const declared = unionMembers(typeName);
  const validated = setMembers(setName);

  const missing = [...declared].filter(v => !validated.has(v));
  const extra = [...validated].filter(v => !declared.has(v));

  if (missing.length) {
    console.error(
      `✗ in ${typeName} but not ${setName} — these would be silently rejected at runtime:\n    ${missing.join(', ')}`
    );
    drifted = true;
  }
  if (extra.length) {
    console.error(`✗ in ${setName} but not ${typeName}:\n    ${extra.join(', ')}`);
    drifted = true;
  }
}

if (drifted) process.exit(1);

console.log('✓ protocol check: app and relay contracts match');

