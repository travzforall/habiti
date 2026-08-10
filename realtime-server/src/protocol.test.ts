import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublishFrame, sanitizeHint } from './protocol.js';

/**
 * These two functions ARE the security boundary. Everything the relay promises
 * — "a client cannot smuggle data through a hint", "a client cannot address the
 * whole userbase" — is enforced here and nowhere else, so it gets tested here.
 */

test('sanitizeHint drops every field it does not know', () => {
  const hint = sanitizeHint({
    scope: ['friends'],
    refKey: 'run-7',
    label: 'invite',
    // The attack: a client attaching authoritative content to a hint, hoping a
    // peer renders it instead of refetching.
    friendName: 'Mallory',
    points: 9999,
    __proto__: { polluted: true }
  });

  assert.deepEqual(hint, { scope: ['friends'], refKey: 'run-7', label: 'invite' });
  assert.equal(Object.keys(hint!).length, 3);
});

test('sanitizeHint rejects unknown scopes and empty scope lists', () => {
  assert.equal(sanitizeHint({ scope: ['not-a-scope'] }), undefined);
  assert.equal(sanitizeHint({ scope: [] }), undefined);
  assert.equal(sanitizeHint({ refKey: 'x' }), undefined);
  assert.equal(sanitizeHint(null), undefined);
  assert.equal(sanitizeHint('friends'), undefined);

  // Mixed valid/invalid keeps only the valid.
  assert.deepEqual(sanitizeHint({ scope: ['friends', 'nope', 'levels'] }), {
    scope: ['friends', 'levels']
  });
});

test('sanitizeHint bounds string lengths', () => {
  const hint = sanitizeHint({ scope: ['habits'], refKey: 'x'.repeat(500), label: 'y'.repeat(500) });
  assert.equal(hint!.refKey!.length, 128);
  assert.equal(hint!.label!.length, 128);
});

test('isPublishFrame accepts a well-formed frame', () => {
  assert.ok(
    isPublishFrame({
      v: 1,
      kind: 'publish',
      event: { kind: 'friend.invited', to: [{ email: 'b@example.com' }], hint: { scope: ['friends'] } }
    })
  );
  assert.ok(
    isPublishFrame({ v: 1, kind: 'publish', event: { kind: 'self.habits', to: [{ userId: '42' }] } })
  );
});

test('isPublishFrame rejects malformed frames', () => {
  const bad = [
    { v: 1, kind: 'publish' },
    { v: 1, kind: 'publish', event: { kind: 'friend.invited', to: [] } },
    { v: 1, kind: 'publish', event: { kind: 'made.up', to: [{ userId: '1' }] } },
    { v: 1, kind: 'publish', event: { kind: 'friend.invited', to: [{ nothing: 'x' }] } },
    { v: 1, kind: 'publish', event: { kind: 'friend.invited', to: 'b@example.com' } }
  ];
  for (const frame of bad) assert.equal(isPublishFrame(frame), false, JSON.stringify(frame));
});

test('isPublishFrame caps the recipient list', () => {
  const to = Array.from({ length: 21 }, (_, i) => ({ userId: String(i) }));
  assert.equal(isPublishFrame({ v: 1, kind: 'publish', event: { kind: 'friend.invited', to } }), false);
  assert.ok(
    isPublishFrame({ v: 1, kind: 'publish', event: { kind: 'friend.invited', to: to.slice(0, 20) } })
  );
});
