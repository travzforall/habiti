import {
  PROJECT_EXPENSE_COLUMNS,
  PROJECT_ITEM_COLUMNS,
  ProjectExpense,
  ProjectExpenseRow,
  ProjectItem,
  ProjectItemRow,
  fromProjectExpense,
  fromProjectItem,
  toProjectExpense,
  toProjectItem
} from './budget.models';

/**
 * Baserow drops a field name it does not recognise instead of rejecting the
 * write, so a typo here is silent data loss — a price that looks saved and is
 * not. Every key the mappers produce has to be a real column.
 */

function item(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: '1',
    projectId: '20',
    title: '10 bags Quikrete',
    quantity: 10,
    unit: 'bags',
    unitCost: 6.5,
    status: 'needed',
    ...overrides
  };
}

function expense(overrides: Partial<ProjectExpense> = {}): ProjectExpense {
  return {
    id: '1',
    projectId: '20',
    title: 'Quikrete x10',
    amount: 65,
    spentAt: new Date(2026, 7, 16),
    ...overrides
  };
}

describe('item rows', () => {
  it('write only columns the table has', () => {
    const keys = Object.keys(fromProjectItem(item(), '1'));
    expect(keys.filter(key => !(PROJECT_ITEM_COLUMNS as readonly string[]).includes(key))).toEqual([]);
  });

  it('round-trip', () => {
    const original = item({ milestoneId: 'm1', supplier: 'Merchant', note: 'For the floor' });
    const back = toProjectItem({ id: 1, ...fromProjectItem(original, '1') } as ProjectItemRow);

    expect(back.title).toBe(original.title);
    expect(back.quantity).toBe(10);
    expect(back.unitCost).toBe(6.5);
    expect(back.unit).toBe('bags');
    expect(back.status).toBe('needed');
    expect(back.milestoneId).toBe('m1');
    expect(back.supplier).toBe('Merchant');
  });

  it('send a planned date as a plain day', () => {
    const row = fromProjectItem(item({ plannedFor: new Date(2026, 8, 4) }), '1');
    expect(row['planned_for']).toBe('2026-09-04');
  });

  it('default an unknown status rather than failing the whole row', () => {
    expect(toProjectItem({ id: 1, status: 'nonsense' } as ProjectItemRow).status).toBe('needed');
  });

  it('keep an unpriced item unpriced instead of calling it zero', () => {
    // Zero and "nobody has looked up the price" are different, and a budget
    // that cannot tell them apart quietly reads as complete.
    const back = toProjectItem({ id: 1, title: 'Vinyl', unit_cost: null } as ProjectItemRow);
    expect(back.unitCost).toBeUndefined();
  });
});

describe('expense rows', () => {
  it('write only columns the table has', () => {
    const keys = Object.keys(fromProjectExpense(expense(), '1'));
    expect(keys.filter(key => !(PROJECT_EXPENSE_COLUMNS as readonly string[]).includes(key))).toEqual([]);
  });

  it('round-trip', () => {
    const original = expense({ itemId: '7', category: 'materials', payee: 'Merchant' });
    const back = toProjectExpense({ id: 1, ...fromProjectExpense(original, '1') } as ProjectExpenseRow);

    expect(back.amount).toBe(65);
    expect(back.spentAt).toEqual(new Date(2026, 7, 16));
    expect(back.itemId).toBe('7');
    expect(back.category).toBe('materials');
  });

  it('keep a refund negative', () => {
    const back = toProjectExpense({
      id: 1,
      ...fromProjectExpense(expense({ amount: -30 }), '1')
    } as ProjectExpenseRow);
    expect(back.amount).toBe(-30);
  });

  it('always produce a date, so sorting cannot break on one bad row', () => {
    const back = toProjectExpense({ id: 1, title: 'x' } as ProjectExpenseRow);
    expect(back.spentAt instanceof Date).toBe(true);
    expect(Number.isNaN(back.spentAt.getTime())).toBe(false);
  });
});
