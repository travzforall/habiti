import { ScorablePlan, scorePlans } from './plan-score';

function plan(overrides: Partial<ScorablePlan> = {}): ScorablePlan {
  return { id: 'p1', ...overrides };
}

describe('ranking plans', () => {
  it('puts the better-rated one first', () => {
    const ranked = scorePlans([
      plan({ id: 'a', rating: 2 }),
      plan({ id: 'b', rating: 5 })
    ]);

    expect(ranked.map(entry => entry.plan.id)).toEqual(['b', 'a']);
  });

  it('prefers cheaper, all else equal', () => {
    const ranked = scorePlans([
      plan({ id: 'dear', cost: 8000 }),
      plan({ id: 'cheap', cost: 2000 })
    ]);

    expect(ranked[0].plan.id).toBe('cheap');
    expect(ranked[0].reasons).toContain('Cheapest of the options');
  });

  it('prefers faster and less risky', () => {
    const ranked = scorePlans([
      plan({ id: 'slow', durationDays: 90, risk: 'high' }),
      plan({ id: 'quick', durationDays: 20, risk: 'low' })
    ]);

    expect(ranked[0].plan.id).toBe('quick');
  });

  it('scores cost against the other plans, not against a number in the code', () => {
    // £4,000 is cheap next to £9,000 and dear next to £900. There is no
    // absolute answer, so the comparison is always relative.
    const cheapHere = scorePlans([plan({ id: 'x', cost: 4000 }), plan({ id: 'y', cost: 9000 })]);
    const dearHere = scorePlans([plan({ id: 'x', cost: 4000 }), plan({ id: 'y', cost: 900 })]);

    expect(cheapHere[0].plan.id).toBe('x');
    expect(dearHere[0].plan.id).toBe('y');
  });

  it('treats an unfilled field as unknown, not as bad', () => {
    // Leaving the risk box empty must not read as "risky".
    const ranked = scorePlans([
      plan({ id: 'blank-risk', rating: 4 }),
      plan({ id: 'high-risk', rating: 4, risk: 'high' })
    ]);

    expect(ranked[0].plan.id).toBe('blank-risk');
  });

  it('parks an empty plan in the middle rather than at the bottom', () => {
    const ranked = scorePlans([plan({ id: 'empty' })]);

    expect(ranked[0].score).toBe(50);
    expect(ranked[0].reasons).toContain('Nothing filled in yet');
  });

  it('says nothing is between them when every option is identical', () => {
    const ranked = scorePlans([plan({ id: 'a', cost: 100 }), plan({ id: 'b', cost: 100 })]);
    expect(ranked[0].score).toBe(ranked[1].score);
  });
});

describe('a decision outranks a calculation', () => {
  it('pins a chosen plan to the top however it scored', () => {
    const ranked = scorePlans([
      plan({ id: 'best-on-paper', rating: 5, cost: 100, risk: 'low' }),
      plan({ id: 'the-one-we-picked', rating: 2, cost: 9000, risk: 'high', status: 'chosen' })
    ]);

    expect(ranked[0].plan.id).toBe('the-one-we-picked');
    expect(ranked[0].chosen).toBe(true);
  });

  it('keeps rejected plans, at the bottom', () => {
    // "We looked at this and said no" is worth remembering when someone
    // suggests it again in three weeks.
    const ranked = scorePlans([
      plan({ id: 'no', rating: 5, status: 'rejected' }),
      plan({ id: 'maybe', rating: 1 })
    ]);

    expect(ranked.map(entry => entry.plan.id)).toEqual(['maybe', 'no']);
  });
});

describe('showing its working', () => {
  it('warns before it praises', () => {
    const [entry] = scorePlans([plan({ id: 'a', rating: 5, risk: 'high', confidence: 30 })]);

    expect(entry.reasons[0]).toContain('30% confident');
    expect(entry.reasons[1]).toBe('High risk');
  });

  it('names the dearest option', () => {
    const ranked = scorePlans([plan({ id: 'a', cost: 100 }), plan({ id: 'b', cost: 9000 })]);
    expect(ranked.find(entry => entry.plan.id === 'b')?.reasons).toContain('Dearest of the options');
  });

  it('never returns a score outside 0-100', () => {
    const ranked = scorePlans([
      plan({ id: 'a', rating: 5, confidence: 500, cost: 1, durationDays: 1, risk: 'low', effort: 'low' }),
      plan({ id: 'b', rating: 1, confidence: -50, cost: 99, durationDays: 99, risk: 'high', effort: 'high' })
    ]);

    for (const entry of ranked) {
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(100);
    }
  });
});
