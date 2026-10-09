import {
  CostedExpense,
  CostedItem,
  allocation,
  committedMinor,
  formatMoney,
  fromMinor,
  itemCost,
  outstandingForItem,
  planByMilestone,
  rollUpByTask,
  summarise,
  toMinor
} from './budget-math';
import { RateTable } from './currency';

function item(overrides: Partial<CostedItem> = {}): CostedItem {
  return { id: 'i1', quantity: 1, unitCost: 10, status: 'needed', ...overrides };
}

function expense(overrides: Partial<CostedExpense> = {}): CostedExpense {
  return { id: 'e1', amount: 10, ...overrides };
}

describe('money in minor units', () => {
  it('adds without drifting', () => {
    // 0.1 + 0.2 in pounds is 0.30000000000000004. In pence it is 30.
    const total = summarise([], [expense({ amount: 0.1 }), expense({ id: 'e2', amount: 0.2 })]);
    expect(total.spent).toBe(0.3);
  });

  it('survives a long column of awkward numbers', () => {
    const expenses = Array.from({ length: 10 }, (_, index) => expense({ id: `e${index}`, amount: 6.5 }));
    expect(summarise([], expenses).spent).toBe(65);
  });

  it('rounds a fraction of a penny once, not repeatedly', () => {
    expect(toMinor(1.005)).toBe(101);
    expect(fromMinor(101)).toBe(1.01);
  });

  it('treats a missing amount as nothing rather than NaN', () => {
    expect(toMinor(undefined)).toBe(0);
    expect(toMinor(Number.NaN)).toBe(0);
  });
});

describe('what one item costs', () => {
  it('is quantity times unit cost', () => {
    expect(itemCost(item({ quantity: 10, unitCost: 6.5 }))).toBe(65);
  });

  it('assumes one of it when no quantity is given', () => {
    expect(itemCost(item({ quantity: undefined, unitCost: 12.99 }))).toBe(12.99);
  });

  it('is nothing when nobody has priced it yet', () => {
    expect(itemCost(item({ unitCost: undefined }))).toBe(0);
  });

  it('handles a fractional quantity, because 2.5 m² is a real amount', () => {
    expect(itemCost(item({ quantity: 2.5, unitCost: 19.99 }))).toBe(49.98);
  });
});

describe('committed', () => {
  it('counts what is needed and what is ordered', () => {
    const items = [
      item({ id: 'a', status: 'needed', unitCost: 10 }),
      item({ id: 'b', status: 'ordered', unitCost: 20 })
    ];
    expect(fromMinor(committedMinor(items))).toBe(30);
  });

  it('stops counting an item once it is in hand', () => {
    // Otherwise a finished project still shows the price of everything it used.
    const items = [item({ id: 'a', status: 'have', unitCost: 10 })];
    expect(committedMinor(items)).toBe(0);
  });
});

describe('the summary', () => {
  it('keeps spent and committed apart, and projects the sum', () => {
    const result = summarise(
      [item({ unitCost: 40, status: 'needed' })],
      [expense({ amount: 60 })],
      200
    );

    expect(result.spent).toBe(60);
    expect(result.committed).toBe(40);
    expect(result.projected).toBe(100);
    expect(result.remaining).toBe(100);
    expect(result.usedPct).toBe(50);
    expect(result.over).toBe(false);
  });

  it('says it is over when the projection passes the budget, before the money goes', () => {
    // The whole point: this is knowable while there is still time to change it.
    const result = summarise([item({ unitCost: 150 })], [expense({ amount: 60 })], 200);

    expect(result.spent).toBe(60);
    expect(result.over).toBe(true);
    expect(result.remaining).toBe(-10);
  });

  it('has no opinion when no budget is set', () => {
    const result = summarise([item({ unitCost: 40 })], [expense({ amount: 60 })]);

    expect(result.remaining).toBeUndefined();
    expect(result.usedPct).toBeUndefined();
    expect(result.over).toBe(false);
  });

  it('does not divide by zero on a zero budget', () => {
    expect(summarise([], [expense({ amount: 5 })], 0).usedPct).toBe(100);
    expect(summarise([], [], 0).usedPct).toBe(0);
  });

  it('takes a refund off the total', () => {
    const result = summarise([], [expense({ amount: 100 }), expense({ id: 'e2', amount: -30 })]);
    expect(result.spent).toBe(70);
  });
});

describe('the item plan', () => {
  const order = ['m1', 'm2'];

  it('groups by milestone, in the project’s own order', () => {
    const plan = planByMilestone(
      [
        item({ id: 'b', milestoneId: 'm2', unitCost: 20 }),
        item({ id: 'a', milestoneId: 'm1', unitCost: 10 })
      ],
      order
    );

    expect(plan.map(group => group.key)).toEqual(['m1', 'm2']);
    expect(plan.map(group => group.subtotal)).toEqual([10, 20]);
  });

  it('carries a running total, which is what you actually want to know', () => {
    const plan = planByMilestone(
      [
        item({ id: 'a', milestoneId: 'm1', unitCost: 10 }),
        item({ id: 'b', milestoneId: 'm2', unitCost: 20 })
      ],
      order
    );

    expect(plan.map(group => group.runningTotal)).toEqual([10, 30]);
  });

  it('puts unscheduled items last, so the running total stays in order', () => {
    const plan = planByMilestone(
      [item({ id: 'loose', unitCost: 5 }), item({ id: 'a', milestoneId: 'm1', unitCost: 10 })],
      order
    );

    expect(plan.map(group => group.key)).toEqual(['m1', undefined]);
    expect(plan[1].runningTotal).toBe(15);
  });

  it('shows an item whose milestone is gone rather than losing it', () => {
    // Same rule as the timeline: a dangling id must not hide real work.
    const plan = planByMilestone([item({ id: 'a', milestoneId: 'deleted', unitCost: 7 })], order);

    expect(plan.length).toBe(1);
    expect(plan[0].key).toBeUndefined();
    expect(plan[0].subtotal).toBe(7);
  });

  it('is empty for no items', () => {
    expect(planByMilestone([], order)).toEqual([]);
  });
});

describe('what an item still owes', () => {
  it('is its cost less what has been paid against it', () => {
    const it1 = item({ id: 'a', quantity: 10, unitCost: 6.5 });
    expect(outstandingForItem(it1, [expense({ amount: 20, itemId: 'a' })])).toBe(45);
  });

  it('never goes below zero, however much was paid', () => {
    const it1 = item({ id: 'a', unitCost: 10 });
    expect(outstandingForItem(it1, [expense({ amount: 25, itemId: 'a' })])).toBe(0);
  });

  it('ignores spending on something else', () => {
    const it1 = item({ id: 'a', unitCost: 10 });
    expect(outstandingForItem(it1, [expense({ amount: 25, itemId: 'b' })])).toBe(10);
  });
});

describe('formatting', () => {
  it('shows money as money', () => {
    expect(formatMoney(65, 'GBP')).toContain('65');
  });

  it('falls back rather than throwing on a currency it does not know', () => {
    expect(formatMoney(65, 'NOPE')).toBe('65.00');
  });
});

describe('allocation — the project budget handed out to tasks', () => {
  it('adds up what the tasks were given', () => {
    expect(allocation([900, 800], 2000).allocated).toBe(1700);
    expect(allocation([900, 800], 2000).unallocated).toBe(300);
    expect(allocation([900, 800], 2000).overAllocated).toBe(false);
  });

  it('says so the moment more is promised than exists', () => {
    // Months before a penny moves, and while it is still cheap to fix.
    const result = allocation([900, 800, 700], 2000);

    expect(result.allocated).toBe(2400);
    expect(result.unallocated).toBe(-400);
    expect(result.overAllocated).toBe(true);
    expect(result.allocatedPct).toBe(120);
  });

  it('ignores tasks with no budget rather than counting them as zero', () => {
    expect(allocation([500, undefined, undefined], 2000).allocated).toBe(500);
  });

  it('has no opinion when the project has no budget', () => {
    const result = allocation([500], undefined);
    expect(result.allocated).toBe(500);
    expect(result.unallocated).toBeUndefined();
    expect(result.overAllocated).toBe(false);
  });

  it('does not divide by zero', () => {
    expect(allocation([10], 0).allocatedPct).toBe(100);
    expect(allocation([], 0).allocatedPct).toBe(0);
  });
});

describe('rolling up by task', () => {
  it('gives each task its own spent, committed and projected', () => {
    const rows = rollUpByTask(
      [item({ id: 'i1', taskId: 't1', unitCost: 65 })],
      [expense({ id: 'e1', taskId: 't1', amount: 20 })],
      new Map([['t1', 100]])
    );

    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual(
      jasmine.objectContaining({ taskId: 't1', spent: 20, committed: 65, projected: 85, remaining: 15 })
    );
  });

  it('flags a task that is over its own budget', () => {
    const rows = rollUpByTask([], [expense({ taskId: 't1', amount: 150 })], new Map([['t1', 100]]));
    expect(rows[0].over).toBe(true);
  });

  it('includes a task that has a budget but no spending yet', () => {
    const rows = rollUpByTask([], [], new Map([['t1', 100]]));
    expect(rows.map(row => row.taskId)).toEqual(['t1']);
    expect(rows[0].projected).toBe(0);
  });

  it('includes a task that has spending but no budget', () => {
    const rows = rollUpByTask([], [expense({ taskId: 't9', amount: 12 })], new Map());
    expect(rows[0].taskId).toBe('t9');
    expect(rows[0].budget).toBeUndefined();
  });

  it('leaves out tasks with no money attached at all', () => {
    // A project of forty tasks must not show thirty-eight empty rows.
    const rows = rollUpByTask([], [], new Map([['quiet', undefined]]));
    expect(rows).toEqual([]);
  });

  it('does not double-count money that belongs to no task', () => {
    const rows = rollUpByTask(
      [item({ id: 'loose', unitCost: 40 })],
      [expense({ id: 'loose-e', amount: 10 })],
      new Map()
    );
    expect(rows).toEqual([]);
  });
});

describe('totals when more than one currency is involved', () => {
  const rates: RateTable = { home: 'GBP', rates: { USD: 1.27 }, updatedAt: new Date(2026, 7, 1) };

  it('converts a foreign amount into the home currency before adding it', () => {
    const result = summarise([], [expense({ amount: 127, currency: 'USD' })], undefined, rates);
    expect(result.spent).toBeCloseTo(100, 2);
    expect(result.unconverted).toEqual([]);
  });

  it('adds a home-currency amount as it is', () => {
    const result = summarise(
      [],
      [expense({ amount: 50 }), expense({ id: 'e2', amount: 127, currency: 'USD' })],
      undefined,
      rates
    );
    expect(result.spent).toBeCloseTo(150, 2);
  });

  it('leaves out what it cannot convert, and says so', () => {
    // The alternative — counting $120 as £120 — is a total that is wrong and
    // looks right, which is the only unacceptable outcome for money.
    const result = summarise(
      [],
      [expense({ amount: 50 }), expense({ id: 'e2', amount: 120, currency: 'JMD' })],
      undefined,
      rates
    );

    expect(result.spent).toBe(50);
    expect(result.unconverted).toEqual(['JMD']);
  });

  it('converts committed items too', () => {
    const result = summarise(
      [item({ quantity: 10, unitCost: 12.7, currency: 'USD' })],
      [],
      undefined,
      rates
    );
    expect(result.committed).toBeCloseTo(100, 2);
  });

  it('behaves exactly as before when no rates are supplied', () => {
    // Everything in one currency is the common case and must not pay for this.
    const result = summarise([item({ unitCost: 40 })], [expense({ amount: 60 })], 200);
    expect(result.projected).toBe(100);
    expect(result.unconverted).toEqual([]);
  });
});
