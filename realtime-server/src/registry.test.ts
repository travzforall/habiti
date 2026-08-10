import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from './registry.js';

interface Fake {
  userId: string | null;
  email: string | null;
  id: string;
}

const conn = (id: string, userId: string, email: string): Fake => ({ id, userId, email });

function delivered(registry: Registry<Fake>, to: Parameters<Registry<Fake>['fanout']>[0]): string[] {
  const hit: string[] = [];
  registry.fanout(to, c => hit.push(c.id));
  return hit.sort();
}

test('reaches a recipient by user id', () => {
  const r = new Registry<Fake>();
  const a = conn('a', '1', 'a@x.com');
  r.add(a, '1', 'a@x.com');
  assert.deepEqual(delivered(r, [{ userId: '1' }]), ['a']);
});

test('reaches a recipient by email, case-insensitively', () => {
  // The case that makes invites work at all: the sender knows only the email.
  const r = new Registry<Fake>();
  r.add(conn('a', '1', 'Alice@Example.com'), '1', 'Alice@Example.com');
  assert.deepEqual(delivered(r, [{ email: 'alice@example.com' }]), ['a']);
  assert.deepEqual(delivered(r, [{ email: 'ALICE@EXAMPLE.COM' }]), ['a']);
});

test('delivers once to a socket addressed both ways', () => {
  const r = new Registry<Fake>();
  r.add(conn('a', '1', 'a@x.com'), '1', 'a@x.com');
  assert.deepEqual(delivered(r, [{ userId: '1' }, { email: 'a@x.com' }]), ['a']);
});

test('delivers to every tab a user has open', () => {
  const r = new Registry<Fake>();
  r.add(conn('t1', '1', 'a@x.com'), '1', 'a@x.com');
  r.add(conn('t2', '1', 'a@x.com'), '1', 'a@x.com');
  assert.deepEqual(delivered(r, [{ userId: '1' }]), ['t1', 't2']);
});

test('an absent recipient is silent, not an error', () => {
  const r = new Registry<Fake>();
  r.add(conn('a', '1', 'a@x.com'), '1', 'a@x.com');
  assert.deepEqual(delivered(r, [{ userId: '999' }]), []);
  assert.deepEqual(delivered(r, [{ email: 'nobody@x.com' }]), []);
});

test('never leaks to a bystander', () => {
  const r = new Registry<Fake>();
  r.add(conn('a', '1', 'a@x.com'), '1', 'a@x.com');
  r.add(conn('b', '2', 'b@x.com'), '2', 'b@x.com');
  assert.deepEqual(delivered(r, [{ userId: '1' }]), ['a']);
});

test('remove unindexes both keys and frees the maps', () => {
  const r = new Registry<Fake>();
  const a = conn('a', '1', 'a@x.com');
  r.add(a, '1', 'a@x.com');
  r.remove(a);

  assert.equal(r.size(), 0);
  assert.deepEqual(r.forUser('1'), []);
  assert.deepEqual(delivered(r, [{ email: 'a@x.com' }]), []);
});

test('removing one tab leaves the other reachable', () => {
  const r = new Registry<Fake>();
  const t1 = conn('t1', '1', 'a@x.com');
  r.add(t1, '1', 'a@x.com');
  r.add(conn('t2', '1', 'a@x.com'), '1', 'a@x.com');

  r.remove(t1);
  assert.deepEqual(delivered(r, [{ userId: '1' }]), ['t2']);
  assert.equal(r.size(), 1);
});

test('a non-string address cannot crash the fanout', () => {
  const r = new Registry<Fake>();
  r.add(conn('a', '1', 'a@x.com'), '1', 'a@x.com');
  assert.deepEqual(delivered(r, [{ userId: 1 } as never]), ['a']);
  assert.deepEqual(delivered(r, [{ email: null } as never]), []);
});
