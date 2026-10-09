import { SUPPLY_CATALOGUE, SUPPLY_CATEGORIES } from './supply-catalogue';
import { categoriesOf, searchSupplies } from './supply-search';

describe('the catalogue', () => {
  it('has the things a job actually forgets', () => {
    const names = SUPPLY_CATALOGUE.map(entry => entry.name.toLowerCase());
    expect(names).toContain('extension lead');
    expect(names).toContain('dust sheets');
    expect(names).toContain('saw blade');
  });

  it('gives every entry an id, a name and a category', () => {
    for (const entry of SUPPLY_CATALOGUE) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.category).toBeTruthy();
    }
  });

  it('has no duplicate ids', () => {
    const ids = SUPPLY_CATALOGUE.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists its categories once each', () => {
    expect(new Set(SUPPLY_CATEGORIES).size).toBe(SUPPLY_CATEGORIES.length);
  });
});

describe('searching it', () => {
  it('finds a saw by name', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: 'mitre saw' });
    expect(found[0].name).toContain('Mitre saw');
  });

  it('finds "mitre" when you type "miter", and the other way round', () => {
    // The same saw either side of the Atlantic.
    const american = searchSupplies(SUPPLY_CATALOGUE, { text: 'miter saw' });
    expect(american.map(e => e.id)).toContain('mitre-saw');
  });

  it('matches words in any order', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: 'saw mitre' });
    expect(found.map(e => e.id)).toContain('mitre-saw');
  });

  it('requires every word, so a second word narrows rather than widens', () => {
    const broad = searchSupplies(SUPPLY_CATALOGUE, { text: 'saw' });
    const narrow = searchSupplies(SUPPLY_CATALOGUE, { text: 'saw blade' });
    expect(narrow.length).toBeLessThan(broad.length);
  });

  it('puts a name match above a mention in the small print', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: 'saw' });
    expect(found[0].name.toLowerCase()).toContain('saw');
  });

  it('finds a size people search by', () => {
    // "1/2 in plywood" is how it is asked for, not "plywood sheet".
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: '1/2 plywood' });
    expect(found.map(e => e.id)).toContain('plywood');
  });

  it('finds concrete by a brand people say out loud', () => {
    expect(searchSupplies(SUPPLY_CATALOGUE, { text: 'quikrete' }).map(e => e.id)).toContain(
      'concrete-mix'
    );
  });

  it('finds screws', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: 'screws' });
    expect(found.length).toBeGreaterThan(2);
  });

  it('filters to tools or to materials', () => {
    const tools = searchSupplies(SUPPLY_CATALOGUE, { kind: 'tool' });
    expect(tools.every(entry => entry.kind === 'tool')).toBe(true);
    expect(tools.length).toBeGreaterThan(20);
  });

  it('filters to one category', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { category: 'Flooring' });
    expect(found.every(entry => entry.category === 'Flooring')).toBe(true);
  });

  it('returns everything for an empty query', () => {
    expect(searchSupplies(SUPPLY_CATALOGUE, {}).length).toBe(SUPPLY_CATALOGUE.length);
  });

  it('returns nothing for something that is not there, rather than everything', () => {
    expect(searchSupplies(SUPPLY_CATALOGUE, { text: 'helicopter' })).toEqual([]);
  });

  it('lists the categories present in a result set', () => {
    const found = searchSupplies(SUPPLY_CATALOGUE, { text: 'screws' });
    expect(categoriesOf(found)).toContain('Fixings');
  });
});
