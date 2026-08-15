/**
 * A stable JSON string for hashing.
 *
 * `JSON.stringify` preserves insertion order, so two objects that are equal in
 * every way that matters can serialise differently and hash differently. That
 * is fine for transport and useless for a content hash, which has to answer
 * "did this document change?" and not "did someone reorder a field?".
 *
 * Object keys are sorted; ARRAY ORDER IS PRESERVED, because in the things this
 * hashes — the blocks of a legal document, the rules of a campaign — order is
 * meaning. Swapping two clauses is a real change.
 *
 * Deliberately dependency-free so it can live in scope:shared and run in a
 * browser, in Node, and in a spec that recomputes a checked-in hash.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);

  // `typeof null === 'object'`, so null must be handled before the object case
  // or it would fall into Object.keys(null) and throw.
  if (value === null || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    // `undefined` is dropped by JSON.stringify anyway. Skipping it here means
    // { a: 1 } and { a: 1, b: undefined } canonicalise identically rather than
    // depending on stringify's behaviour to agree.
    if (source[key] === undefined) continue;
    sorted[key] = canonicalise(source[key]);
  }
  return sorted;
}
