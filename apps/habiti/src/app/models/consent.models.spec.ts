import {
  CONSENT_COLUMNS,
  ConsentRecord,
  ConsentRow,
  fromConsentRow,
  toConsentRow
} from './consent.models';

function record(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: 'cns_1',
    userId: '42',
    kind: 'special_category',
    scope: 'health',
    accepted: true,
    acceptedAt: '2026-10-08T09:00:00.000Z',
    surface: 'habit_add',
    writtenBy: 'client',
    ...overrides
  };
}

describe('consent rows', () => {
  it('writes only columns the table has', () => {
    const keys = Object.keys(toConsentRow(record(), '1.0.0'));
    expect(keys.filter(key => !(CONSENT_COLUMNS as readonly string[]).includes(key))).toEqual([]);
  });

  it('writes every column it declares', () => {
    const keys = Object.keys(toConsentRow(record(), '1.0.0'));
    expect((CONSENT_COLUMNS as readonly string[]).filter(c => !keys.includes(c))).toEqual([]);
  });

  it('round-trips a document acceptance', () => {
    const original = record({
      kind: 'document_acceptance',
      documentId: 'privacy',
      documentVersion: 1,
      contentHash: 'abc123',
      scope: undefined,
      surface: 'reacceptance_gate'
    });

    const back = fromConsentRow({ id: 7, ...toConsentRow(original, '1.0.0') } as ConsentRow);

    expect(back.kind).toBe('document_acceptance');
    expect(back.documentId).toBe('privacy');
    expect(back.documentVersion).toBe(1);
    expect(back.contentHash).toBe('abc123');
    expect(back.accepted).toBeTrue();
    expect(back.surface).toBe('reacceptance_gate');
    expect(back.writtenBy).toBe('client');
  });

  /**
   * The one that is not merely a round-trip.
   *
   * `accepted` is compared with `=== true` in fromConsentRow, so a column that
   * Baserow dropped — arriving as undefined — reads as a refusal rather than as
   * an acceptance. An "undefined consent" must never resolve to consent, and
   * this pins that direction.
   */
  it('treats a missing accepted column as not accepted', () => {
    const row = { id: 8, ...toConsentRow(record(), '1.0.0') } as ConsentRow;
    delete (row as unknown as Record<string, unknown>)['accepted'];

    expect(fromConsentRow(row).accepted).toBeFalse();
  });

  it('keeps an explicit refusal as a refusal', () => {
    const back = fromConsentRow({
      id: 9,
      ...toConsentRow(record({ accepted: false }), '1.0.0')
    } as ConsentRow);

    expect(back.accepted).toBeFalse();
  });
});
