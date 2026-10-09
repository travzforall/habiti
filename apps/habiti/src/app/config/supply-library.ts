import { SUPPLY_CATALOGUE, SupplyEntry, SupplyKind } from './supply-catalogue';
import { ToolStatus } from './tool-cost';

/**
 * One list of everything this person can pick from.
 *
 * ── WHY OVERRIDES AND NOT COPIES ──────────────────────────────────────────
 *
 * The obvious build is to copy the whole catalogue into the account on first
 * run, so every row is editable. That means 140 rows per person of data nobody
 * has touched, a write on sign-up, and — the part that actually bites — a
 * catalogue that can never be improved, because everyone is holding a snapshot
 * of the day they joined.
 *
 * So the catalogue stays where it is and the account stores only what has
 * CHANGED: this one is hidden, that one costs £6.50 round here, and these six
 * are mine and were never in the list. A new entry in a later version appears
 * for everybody; an edited one keeps its edit.
 *
 * ── AND WHY MOST OF IT STARTS OUT OF THE WAY ──────────────────────────────
 *
 * Nobody needs a core drill. A picker that opens on 140 rows is a list you
 * scroll past rather than read, so it opens on the couple of dozen marked
 * common and everything else is one toggle away — hidden, not removed, because
 * "I will never need that" is wrong about twice a year.
 */

export interface SupplyOverride {
  id: string;
  /** The catalogue entry this changes. Blank for something of the user's own. */
  catalogueId?: string;
  title?: string;
  kind?: SupplyKind;
  category?: string;
  unit?: string;
  sizes?: string[];
  defaultStatus?: ToolStatus;
  /** What it costs round here — a price worth remembering between jobs. */
  defaultCost?: number;
  hidden?: boolean;
  /** Pinned to the top of the picker, whatever the catalogue thinks. */
  favourite?: boolean;
  url?: string;
  sku?: string;
  note?: string;
}

/** A catalogue entry, an override, or both, as the picker sees it. */
export interface LibraryEntry {
  id: string;
  title: string;
  kind: SupplyKind;
  category: string;
  unit?: string;
  sizes?: string[];
  defaultStatus?: ToolStatus;
  defaultCost?: number;
  hidden: boolean;
  favourite: boolean;
  /** True when nothing in the catalogue matches — the user made it. */
  custom: boolean;
  /** True when a catalogue entry has been changed here. */
  edited: boolean;
  common: boolean;
  also?: string[];
  url?: string;
  sku?: string;
  note?: string;
  /** The row id of the override, when there is one. */
  overrideId?: string;
}

function fromCatalogue(entry: SupplyEntry, override?: SupplyOverride): LibraryEntry {
  return {
    id: entry.id,
    title: override?.title ?? entry.name,
    kind: override?.kind ?? entry.kind,
    category: override?.category ?? entry.category,
    unit: override?.unit ?? entry.unit,
    sizes: override?.sizes ?? entry.sizes,
    defaultStatus: override?.defaultStatus ?? entry.typical,
    defaultCost: override?.defaultCost,
    // Hidden unless said otherwise; an uncommon entry starts out of the way.
    hidden: override?.hidden ?? !entry.common,
    favourite: override?.favourite ?? false,
    custom: false,
    edited: !!override,
    common: !!entry.common,
    also: entry.also,
    url: override?.url,
    sku: override?.sku,
    note: override?.note,
    overrideId: override?.id
  };
}

function fromOverride(override: SupplyOverride): LibraryEntry {
  return {
    id: `own:${override.id}`,
    title: override.title ?? 'Untitled',
    kind: override.kind ?? 'material',
    category: override.category ?? 'Mine',
    unit: override.unit,
    sizes: override.sizes,
    defaultStatus: override.defaultStatus,
    defaultCost: override.defaultCost,
    hidden: override.hidden ?? false,
    favourite: override.favourite ?? false,
    custom: true,
    edited: true,
    // Something added by hand is wanted by definition, so it shows.
    common: true,
    url: override.url,
    sku: override.sku,
    note: override.note,
    overrideId: override.id
  };
}

/**
 * The catalogue and the account's changes, as one list.
 *
 * An override pointing at a catalogue entry that no longer exists becomes a
 * custom entry rather than vanishing: someone priced it and hid it, and losing
 * that silently because a later version renamed an id would be worse than an
 * orphan in the list.
 */
export function buildLibrary(
  overrides: readonly SupplyOverride[],
  catalogue: readonly SupplyEntry[] = SUPPLY_CATALOGUE
): LibraryEntry[] {
  const byCatalogueId = new Map(
    overrides.filter(o => o.catalogueId).map(o => [o.catalogueId as string, o])
  );
  const knownIds = new Set(catalogue.map(entry => entry.id));

  const fromList = catalogue.map(entry => fromCatalogue(entry, byCatalogueId.get(entry.id)));

  const own = overrides
    .filter(o => !o.catalogueId || !knownIds.has(o.catalogueId))
    .map(fromOverride);

  return [...fromList, ...own];
}

/** What the picker shows: visible entries, favourites first. */
export function pickable(library: readonly LibraryEntry[], showHidden = false): LibraryEntry[] {
  return library
    .filter(entry => showHidden || !entry.hidden)
    .sort(
      (a, b) =>
        Number(b.favourite) - Number(a.favourite) ||
        Number(b.custom) - Number(a.custom) ||
        a.title.localeCompare(b.title)
    );
}

export function countHidden(library: readonly LibraryEntry[]): number {
  return library.filter(entry => entry.hidden).length;
}
