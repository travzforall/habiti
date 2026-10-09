import { SupplyEntry } from './supply-catalogue';
import { SupplyOverride, buildLibrary, countHidden, pickable } from './supply-library';

const catalogue: SupplyEntry[] = [
  { id: 'mitre-saw', name: 'Mitre saw', kind: 'tool', category: 'Cutting', typical: 'hire', common: true },
  { id: 'core-drill', name: 'Core drill', kind: 'tool', category: 'Drilling', typical: 'hire' },
  { id: 'plywood', name: 'Plywood sheet', kind: 'material', category: 'Timber', sizes: ['1/2 in'], common: true }
];

function override(changes: Partial<SupplyOverride> = {}): SupplyOverride {
  return { id: 'o1', ...changes };
}

describe('building the list', () => {
  it('starts from the catalogue when nothing has been changed', () => {
    const library = buildLibrary([], catalogue);
    expect(library.map(entry => entry.id).sort()).toEqual(['core-drill', 'mitre-saw', 'plywood']);
  });

  it('hides the uncommon ones and shows the common ones', () => {
    // A picker that opens on 140 rows is one you scroll past.
    const library = buildLibrary([], catalogue);

    expect(library.find(e => e.id === 'mitre-saw')!.hidden).toBe(false);
    expect(library.find(e => e.id === 'core-drill')!.hidden).toBe(true);
  });

  it('lets an override show something the catalogue hid', () => {
    const library = buildLibrary([override({ catalogueId: 'core-drill', hidden: false })], catalogue);
    expect(library.find(e => e.id === 'core-drill')!.hidden).toBe(false);
  });

  it('lets an override hide something the catalogue showed', () => {
    const library = buildLibrary([override({ catalogueId: 'mitre-saw', hidden: true })], catalogue);
    expect(library.find(e => e.id === 'mitre-saw')!.hidden).toBe(true);
  });

  it('keeps a price without copying anything else', () => {
    // The rest still comes from the catalogue, so a later version can improve
    // the name, the sizes and the category of an entry someone has priced.
    const library = buildLibrary([override({ catalogueId: 'plywood', defaultCost: 42 })], catalogue);
    const entry = library.find(e => e.id === 'plywood')!;

    expect(entry.defaultCost).toBe(42);
    expect(entry.title).toBe('Plywood sheet');
    expect(entry.sizes).toEqual(['1/2 in']);
    expect(entry.edited).toBe(true);
  });

  it('takes a renamed title from the override', () => {
    const library = buildLibrary(
      [override({ catalogueId: 'plywood', title: 'Ply (the good stuff)' })],
      catalogue
    );
    expect(library.find(e => e.id === 'plywood')!.title).toBe('Ply (the good stuff)');
  });

  it('adds things of the user’s own', () => {
    const library = buildLibrary([override({ id: 'o9', title: 'Dad’s ladder', kind: 'tool' })], catalogue);
    const mine = library.find(entry => entry.custom)!;

    expect(mine.title).toBe('Dad’s ladder');
    expect(mine.hidden).toBe(false);
    expect(mine.id).toBe('own:o9');
  });

  it('keeps an override whose catalogue entry has gone, rather than losing the work', () => {
    // Someone priced it and hid it; a renamed id in a later version must not
    // silently take that away.
    const library = buildLibrary(
      [override({ id: 'o5', catalogueId: 'retired-thing', title: 'Retired thing', defaultCost: 10 })],
      catalogue
    );

    const orphan = library.find(entry => entry.title === 'Retired thing')!;
    expect(orphan.custom).toBe(true);
    expect(orphan.defaultCost).toBe(10);
  });
});

describe('what the picker offers', () => {
  it('leaves out the hidden ones', () => {
    const shown = pickable(buildLibrary([], catalogue));
    expect(shown.map(e => e.id)).not.toContain('core-drill');
  });

  it('shows everything when asked', () => {
    const shown = pickable(buildLibrary([], catalogue), true);
    expect(shown.length).toBe(3);
  });

  it('puts favourites first, then your own, then the rest', () => {
    const library = buildLibrary(
      [
        override({ id: 'o1', catalogueId: 'plywood', favourite: true }),
        override({ id: 'o2', title: 'My thing', kind: 'tool' })
      ],
      catalogue
    );

    expect(pickable(library).map(e => e.title)).toEqual(['Plywood sheet', 'My thing', 'Mitre saw']);
  });

  it('counts what is hidden, for the "show all" label', () => {
    expect(countHidden(buildLibrary([], catalogue))).toBe(1);
  });
});
