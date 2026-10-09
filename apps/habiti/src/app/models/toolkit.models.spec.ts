import {
  TOOLKIT_COLUMNS,
  TOOLKIT_KINDS,
  TOOLKIT_KIND_META,
  TOOLKIT_STATUSES,
  TOOLKIT_STATUS_META,
  ToolkitItem,
  ToolkitItemRow,
  fromToolkitItem,
  iconFor,
  parseHabitIds,
  summarise,
  toProjectItemDraft,
  toToolkitItem
} from './toolkit.models';

function item(over: Partial<ToolkitItem> = {}): ToolkitItem {
  return {
    id: '1',
    userId: '42',
    title: 'Cordless drill',
    kind: 'tool',
    status: 'have',
    linkedHabitIds: [],
    archived: false,
    ...over
  };
}

describe('toolkit.models', () => {
  describe('metadata', () => {
    it('describes every kind and status', () => {
      for (const kind of TOOLKIT_KINDS) expect(TOOLKIT_KIND_META[kind]).toBeDefined();
      for (const status of TOOLKIT_STATUSES) expect(TOOLKIT_STATUS_META[status]).toBeDefined();
    });

    it('treats references as uncosted', () => {
      // A wiring diagram has no unit cost, and counting one would quietly
      // corrupt the kit's value.
      expect(TOOLKIT_KIND_META['reference'].costed).toBe(false);
      expect(TOOLKIT_KIND_META['tool'].costed).toBe(true);
    });

    it('marks exactly the two statuses that belong on a shopping list', () => {
      const wanted = TOOLKIT_STATUSES.filter(s => TOOLKIT_STATUS_META[s].wanted);
      expect(wanted.sort()).toEqual(['broken', 'need']);
    });

    it('never calls a wanted status available', () => {
      for (const status of TOOLKIT_STATUSES) {
        const meta = TOOLKIT_STATUS_META[status];
        expect(meta.available && meta.wanted).withContext(status).toBe(false);
      }
    });
  });

  describe('row conversion', () => {
    it('round-trips the fields that matter', () => {
      const original = item({
        kind: 'material',
        status: 'need',
        quantity: 4,
        unit: 'litres',
        unitCost: 18.5,
        supplier: 'Toolstation',
        location: 'Van',
        linkedHabitIds: ['back-squat', 'deadlift'],
        purchasedOn: new Date(2025, 2, 14)
      });

      const written = fromToolkitItem(original, '42');
      const back = toToolkitItem({ id: 1, ...written } as ToolkitItemRow);

      expect(back.title).toBe(original.title);
      expect(back.kind).toBe('material');
      expect(back.status).toBe('need');
      expect(back.quantity).toBe(4);
      expect(back.unitCost).toBe(18.5);
      expect(back.linkedHabitIds).toEqual(['back-squat', 'deadlift']);
      expect(back.purchasedOn?.getFullYear()).toBe(2025);
      expect(back.purchasedOn?.getDate()).toBe(14);
    });

    it('does not write an id — Baserow assigns it', () => {
      expect(fromToolkitItem(item(), '42')['id']).toBeUndefined();
    });

    it('reads a select that arrives as an object', () => {
      const row = { id: 1, kind: { id: 9, value: 'software' }, status: { id: 3, value: 'ordered' } };
      const parsed = toToolkitItem(row as unknown as ToolkitItemRow);

      expect(parsed.kind).toBe('software');
      expect(parsed.status).toBe('ordered');
    });

    it('falls back rather than throwing on an unknown select', () => {
      const parsed = toToolkitItem({ id: 1, kind: 'nonsense', status: 'gone' } as ToolkitItemRow);
      expect(parsed.kind).toBe('tool');
      expect(parsed.status).toBe('have');
    });

    it('parses numbers that arrive as strings', () => {
      // Baserow returns numerics as strings often enough to matter.
      const parsed = toToolkitItem({
        id: 1,
        quantity: '3',
        unit_cost: '12.50'
      } as unknown as ToolkitItemRow);

      expect(parsed.quantity).toBe(3);
      expect(parsed.unitCost).toBe(12.5);
    });

    it('leaves an absent number undefined rather than zero', () => {
      // 0 and "not recorded" are different, and conflating them makes an
      // unpriced item look free.
      const parsed = toToolkitItem({ id: 1 } as ToolkitItemRow);
      expect(parsed.quantity).toBeUndefined();
      expect(parsed.unitCost).toBeUndefined();
    });
  });

  describe('parseHabitIds', () => {
    it('splits, trims and drops blanks', () => {
      expect(parseHabitIds('back-squat, deadlift ,, bench-press')).toEqual([
        'back-squat',
        'deadlift',
        'bench-press'
      ]);
    });

    it('handles nothing at all', () => {
      expect(parseHabitIds(null)).toEqual([]);
      expect(parseHabitIds('')).toEqual([]);
    });
  });

  describe('iconFor', () => {
    it('prefers the item icon and falls back per kind', () => {
      expect(iconFor({ icon: '🪚', kind: 'tool' })).toBe('🪚');
      expect(iconFor({ icon: '  ', kind: 'material' })).toBe(TOOLKIT_KIND_META['material'].icon);
      expect(iconFor({ icon: undefined, kind: 'software' })).toBe(TOOLKIT_KIND_META['software'].icon);
    });
  });

  describe('summarise', () => {
    it('counts only what is not archived', () => {
      const s = summarise([item(), item({ id: '2', archived: true })]);
      expect(s.total).toBe(1);
    });

    it('separates available from wanted', () => {
      const s = summarise([
        item({ status: 'have' }),
        item({ id: '2', status: 'need' }),
        item({ id: '3', status: 'broken' }),
        item({ id: '4', status: 'ordered' })
      ]);

      expect(s.available).toBe(1);
      expect(s.wanted).toBe(2);
    });

    it('values quantity times unit cost', () => {
      const s = summarise([item({ quantity: 3, unitCost: 10 })]);
      expect(s.value).toBe(30);
    });

    it('treats a missing quantity as one, not zero', () => {
      // An item with a price and no quantity is one of them. Zero would value
      // a whole kit at nothing.
      const s = summarise([item({ unitCost: 89.99 })]);
      expect(s.value).toBeCloseTo(89.99, 2);
    });

    it('ignores the cost of uncosted kinds', () => {
      const s = summarise([item({ kind: 'reference', unitCost: 500, quantity: 2 })]);
      expect(s.value).toBe(0);
    });

    it('prices only the gaps in wantedValue', () => {
      const s = summarise([
        item({ status: 'have', unitCost: 100 }),
        item({ id: '2', status: 'need', unitCost: 40 }),
        item({ id: '3', status: 'broken', unitCost: 25 })
      ]);

      expect(s.value).toBe(165);
      expect(s.wantedValue).toBe(65);
    });

    it('breaks down by kind', () => {
      const s = summarise([item(), item({ id: '2', kind: 'material' }), item({ id: '3', kind: 'material' })]);
      expect(s.byKind['tool']).toBe(1);
      expect(s.byKind['material']).toBe(2);
      expect(s.byKind['software']).toBe(0);
    });

    it('handles an empty kit', () => {
      const s = summarise([]);
      expect(s.total).toBe(0);
      expect(s.value).toBe(0);
    });
  });

  describe('toProjectItemDraft', () => {
    it('carries the details a job needs', () => {
      const draft = toProjectItemDraft(
        item({ unit: 'litres', unitCost: 18.5, supplier: 'Toolstation', url: 'https://x' })
      );

      expect(draft.title).toBe('Cordless drill');
      expect(draft.unit).toBe('litres');
      expect(draft.unitCost).toBe(18.5);
      expect(draft.supplier).toBe('Toolstation');
    });

    it('does NOT carry quantity', () => {
      // How many you own says nothing about how many this job needs.
      const draft = toProjectItemDraft(item({ quantity: 12 })) as Record<string, unknown>;
      expect(draft['quantity']).toBeUndefined();
    });
  });

  describe('row columns', () => {
    it('writes only columns the table has', () => {
      const keys = Object.keys(fromToolkitItem(item(), '1'));
      expect(keys.filter(key => !(TOOLKIT_COLUMNS as readonly string[]).includes(key))).toEqual([]);
    });

    it('writes every column it declares', () => {
      // The other direction matters too: a column dropped from the mapper but
      // left in TOOLKIT_COLUMNS makes verify:fields guard something nothing
      // writes, which reads as coverage it does not have.
      const keys = Object.keys(fromToolkitItem(item(), '1'));
      expect((TOOLKIT_COLUMNS as readonly string[]).filter(c => !keys.includes(c))).toEqual([]);
    });
  });
});
