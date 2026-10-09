import { SupplyEntry, SupplyKind } from './supply-catalogue';

/**
 * Finding things in the catalogue.
 *
 * Ranked rather than merely filtered: typing "saw" should put "Hand saw" above
 * "Sawdust bags", and typing "mitre" must find the entry whose name says
 * "Mitre" and whose `also` says "miter", because half the world spells it the
 * other way.
 */

export interface SupplyFilter {
  text?: string;
  kind?: SupplyKind | 'all';
  category?: string | 'all';
}

/**
 * Splits a query into words, so "mitre saw" matches an entry containing both
 * in any order — people type what they remember, not what is on the label.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9/."]+/i)
    .filter(word => word.length > 0);
}

function haystack(entry: SupplyEntry): string {
  return [entry.name, entry.category, entry.unit, ...(entry.sizes ?? []), ...(entry.also ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * How well an entry answers a query. Higher is better, 0 means it does not.
 *
 * A word that starts the name beats one buried in a synonym: "saw" should lead
 * with the saws, not with the sandpaper that happens to mention one.
 */
function score(entry: SupplyEntry, queryWords: string[]): number {
  if (queryWords.length === 0) return 1;

  const name = entry.name.toLowerCase();
  const all = haystack(entry);
  let total = 0;

  for (const word of queryWords) {
    if (!all.includes(word)) return 0; // every word must appear somewhere
    if (name.startsWith(word)) total += 4;
    else if (name.includes(word)) total += 3;
    else total += 1;
  }

  return total;
}

export function searchSupplies(
  catalogue: readonly SupplyEntry[],
  filter: SupplyFilter
): SupplyEntry[] {
  const queryWords = words(filter.text ?? '');

  return catalogue
    .filter(entry => filter.kind === undefined || filter.kind === 'all' || entry.kind === filter.kind)
    .filter(
      entry =>
        filter.category === undefined ||
        filter.category === 'all' ||
        entry.category === filter.category
    )
    .map(entry => ({ entry, rank: score(entry, queryWords) }))
    .filter(row => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.entry.name.localeCompare(b.entry.name))
    .map(row => row.entry);
}

/** The categories present in a set of results, for the filter chips. */
export function categoriesOf(entries: readonly SupplyEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.category))].sort();
}
