import { canonicalJson } from './canonical-json.util';

/**
 * The whole value of this function is that two things which SHOULD hash the
 * same do, and two things which should NOT, don't. Everything here is one of
 * those two cases.
 */
describe('canonicalJson', () => {
  it('ignores key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('ignores key order at every depth', () => {
    const one = { outer: { z: 1, a: { y: 2, b: 3 } } };
    const two = { outer: { a: { b: 3, y: 2 }, z: 1 } };
    expect(canonicalJson(one)).toBe(canonicalJson(two));
  });

  it('PRESERVES array order — swapping two clauses is a real change', () => {
    expect(canonicalJson(['a', 'b'])).not.toBe(canonicalJson(['b', 'a']));
  });

  it('treats an absent key and an undefined key as the same thing', () => {
    expect(canonicalJson({ a: 1 })).toBe(canonicalJson({ a: 1, b: undefined }));
  });

  it('does not throw on null', () => {
    // typeof null === 'object', so a naive implementation reaches
    // Object.keys(null) and throws.
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
    expect(canonicalJson(null)).toBe('null');
  });

  it('notices a changed value', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it('distinguishes a number from its string', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: '1' }));
  });

  it('handles arrays of objects, sorting within each element', () => {
    const one = [{ b: 1, a: 2 }, { d: 3, c: 4 }];
    const two = [{ a: 2, b: 1 }, { c: 4, d: 3 }];
    expect(canonicalJson(one)).toBe(canonicalJson(two));
  });
});
