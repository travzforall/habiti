import { LEGAL_DOCUMENT_ORDER, LEGAL_INDEX, legalRoute, legalSummary } from './registry';

/**
 * The registry's shape.
 *
 * The other half of the registry's contract — that it never imports the prose,
 * which is what keeps seven legal documents out of the initial bundle — is a
 * fact about the SOURCE FILE and is checked by `scripts/check-legal.mjs`. It
 * cannot be checked here: the Angular Karma builder bundles rather than serving
 * raw .ts, so a spec has no way to read the file it wants to assert about, and
 * importing it would be the very thing under test.
 */
describe('the legal registry', () => {
  it('orders every document exactly once', () => {
    expect(new Set(LEGAL_DOCUMENT_ORDER).size).toBe(LEGAL_DOCUMENT_ORDER.length);
    expect([...LEGAL_DOCUMENT_ORDER].sort()).toEqual(
      (Object.keys(LEGAL_INDEX) as typeof LEGAL_DOCUMENT_ORDER[number][]).sort()
    );
  });

  it('leads with the two documents a user has to accept', () => {
    expect(LEGAL_DOCUMENT_ORDER.slice(0, 2)).toEqual(['terms', 'privacy']);
  });

  it('resolves a summary for every id', () => {
    for (const id of LEGAL_DOCUMENT_ORDER) {
      expect(legalSummary(id).id).toBe(id);
    }
  });

  it('builds routes with and without a version', () => {
    expect(legalRoute('privacy')).toBe('/legal/privacy');
    expect(legalRoute('privacy', 2)).toBe('/legal/privacy/v/2');
  });
});
