import {
  CostedTool,
  overdueTools,
  stillToGet,
  toReturn,
  toolCost,
  toolsCommittedMinor
} from './tool-cost';

function tool(overrides: Partial<CostedTool> = {}): CostedTool {
  return { id: 't1', status: 'buy', purchaseCost: 120, ...overrides };
}

describe('what a tool costs', () => {
  it('is nothing when it is already in the shed', () => {
    expect(toolCost(tool({ status: 'own', purchaseCost: 500 }))).toBe(0);
  });

  it('is nothing when someone is lending it', () => {
    expect(toolCost(tool({ status: 'borrow', purchaseCost: 500 }))).toBe(0);
  });

  it('is the price when it is being bought', () => {
    expect(toolCost(tool({ status: 'buy', purchaseCost: 129.99 }))).toBe(129.99);
  });

  it('is rate times days when it is being hired', () => {
    expect(toolCost(tool({ status: 'hire', hireRate: 45, hireDays: 2 }))).toBe(90);
  });

  it('treats a hire with no days named as one day, not as free', () => {
    expect(toolCost(tool({ status: 'hire', hireRate: 45 }))).toBe(45);
    expect(toolCost(tool({ status: 'hire', hireRate: 45, hireDays: 0 }))).toBe(45);
  });

  it('is nothing when nobody has priced it yet', () => {
    expect(toolCost(tool({ status: 'buy', purchaseCost: undefined }))).toBe(0);
  });

  it('does not drift on an awkward rate', () => {
    expect(toolCost(tool({ status: 'hire', hireRate: 6.5, hireDays: 10 }))).toBe(65);
  });
});

describe('what still has to be got hold of', () => {
  it('leaves out what is already owned', () => {
    const tools = [tool({ id: 'own', status: 'own' }), tool({ id: 'buy' })];
    expect(stillToGet(tools).map(t => t.id)).toEqual(['buy']);
  });

  it('leaves out what is already in hand', () => {
    const tools = [tool({ id: 'here', inHand: true }), tool({ id: 'not' })];
    expect(stillToGet(tools).map(t => t.id)).toEqual(['not']);
  });

  it('still lists a hire that is booked but not collected', () => {
    // "Booked" and "in the van" are not the same thing on the morning.
    const tools = [tool({ id: 'booked', status: 'hire', hireRate: 45, inHand: false })];
    expect(stillToGet(tools).length).toBe(1);
  });
});

describe('what the tools add to a budget', () => {
  it('counts a hire and a purchase, not a loan', () => {
    const tools = [
      tool({ id: 'a', status: 'hire', hireRate: 45, hireDays: 2 }),
      tool({ id: 'b', status: 'buy', purchaseCost: 120 }),
      tool({ id: 'c', status: 'borrow' }),
      tool({ id: 'd', status: 'own' })
    ];

    expect(toolsCommittedMinor(tools) / 100).toBe(210);
  });

  it('stops counting a bought tool once it is here, because it is an expense by then', () => {
    const tools = [tool({ status: 'buy', purchaseCost: 120, inHand: true })];
    expect(toolsCommittedMinor(tools)).toBe(0);
  });

  it('keeps counting a hired tool that has arrived, because the hire is still owed', () => {
    const tools = [tool({ status: 'hire', hireRate: 45, hireDays: 3, inHand: true })];
    expect(toolsCommittedMinor(tools) / 100).toBe(135);
  });
});

describe('what has to go back', () => {
  it('lists borrowed and hired tools, soonest first', () => {
    const tools = [
      tool({ id: 'late', status: 'borrow', returnBy: new Date(2026, 8, 20) }),
      tool({ id: 'soon', status: 'hire', returnBy: new Date(2026, 8, 4) }),
      tool({ id: 'mine', status: 'own', returnBy: new Date(2026, 8, 1) })
    ];

    expect(toReturn(tools).map(t => t.id)).toEqual(['soon', 'late']);
  });

  it('says nothing about a loan with no date on it', () => {
    // Which is its own problem, but not one a return list can solve.
    expect(toReturn([tool({ status: 'borrow' })])).toEqual([]);
  });
});

describe('tools that are late', () => {
  const today = new Date(2026, 8, 10);

  it('are the ones needed before now and still not here', () => {
    const tools = [
      tool({ id: 'late', neededBy: new Date(2026, 8, 1) }),
      tool({ id: 'soon', neededBy: new Date(2026, 8, 20) }),
      tool({ id: 'here', neededBy: new Date(2026, 8, 1), inHand: true })
    ];

    expect(overdueTools(tools, today).map(t => t.id)).toEqual(['late']);
  });

  it('never include something already owned', () => {
    const tools = [tool({ status: 'own', neededBy: new Date(2026, 7, 1) })];
    expect(overdueTools(tools, today)).toEqual([]);
  });
});
