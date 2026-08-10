/**
 * Daily inspiration shown on the dashboard, and the subscription tier that
 * decides which categories a user may pick from.
 */

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/**
 * Habiti's own plan, and the only subscription concept in the app.
 *
 * This is a CATALOGUE grant: it says which content and features a user may
 * reach. It is not the same thing as access to one specific paid item — that
 * will be a per-item entitlement, and conflating the two is what makes
 * "subscriber" and "bought this" impossible to tell apart later.
 */
export type PlanTier = 'free' | 'plus';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type DailyContentCategory = 'scripture' | 'quotes' | 'stoic' | 'affirmations';

export const DAILY_CONTENT_CATEGORIES: readonly DailyContentCategory[] = [
  'scripture',
  'quotes',
  'stoic',
  'affirmations'
] as const;

export interface DailyContentCategoryMeta {
  id: DailyContentCategory;
  label: string;
  description: string;
  icon: string;
  /** Free members only get scripture; the rest need a paid plan. */
  minTier: PlanTier;
}

export const DAILY_CONTENT_CATEGORY_META: Record<DailyContentCategory, DailyContentCategoryMeta> = {
  scripture: {
    id: 'scripture',
    label: 'Scripture',
    description: 'A daily verse',
    icon: '✝️',
    minTier: 'free'
  },
  quotes: {
    id: 'quotes',
    label: 'Motivational',
    description: 'Quotes from people who did the work',
    icon: '💬',
    minTier: 'plus'
  },
  stoic: {
    id: 'stoic',
    label: 'Stoic',
    description: 'Marcus Aurelius, Seneca, Epictetus',
    icon: '🏛️',
    minTier: 'plus'
  },
  affirmations: {
    id: 'affirmations',
    label: 'Affirmations',
    description: 'Written for you, not quoted',
    icon: '🌱',
    minTier: 'plus'
  }
};

/** App-domain shape (string id, camelCase) — mirrors project.model.ts conventions. */
export interface DailyContent {
  id: string;
  category: DailyContentCategory;
  body: string;
  attribution?: string;
  reference?: string;
  translation?: string;
  sourceUrl?: string;
  sortIndex: number;
  pinnedDate?: string;
  minTier: PlanTier;
  active: boolean;
}

/** Baserow row shape (numeric id, snake_case) — mirrors database.models.ts. */
export interface DailyContentRow {
  id: number;
  category: string;
  body: string;
  attribution?: string;
  reference?: string;
  translation?: string;
  source_url?: string;
  sort_index?: number;
  pinned_date?: string;
  min_tier?: string;
  active?: boolean;
}

export function toDailyContent(row: DailyContentRow): DailyContent {
  return {
    id: String(row.id),
    category: (row.category as DailyContentCategory) ?? 'scripture',
    body: row.body ?? '',
    attribution: row.attribution || undefined,
    reference: row.reference || undefined,
    translation: row.translation || undefined,
    sourceUrl: row.source_url || undefined,
    sortIndex: row.sort_index ?? 0,
    pinnedDate: row.pinned_date || undefined,
    minTier: row.min_tier === 'plus' ? 'plus' : 'free',
    active: row.active !== false
  };
}

/**
 * Day of the year, 1-365/366, in local time.
 *
 * This is the rotation index. It must be local, not UTC — otherwise the item
 * changes at the wrong moment of the user's day.
 */
export function dayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Picks the item for a given day.
 *
 * Deterministic on purpose: the same day yields the same item on every device
 * and across refreshes. A `pinnedDate` match always wins.
 */
export function pickForDay(items: DailyContent[], date: Date = new Date()): DailyContent | null {
  const usable = items.filter(i => i.active);
  if (usable.length === 0) return null;

  const iso = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  const pinned = usable.find(i => i.pinnedDate === iso);
  if (pinned) return pinned;

  const rotation = usable
    .filter(i => !i.pinnedDate)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));
  if (rotation.length === 0) return usable[0];

  return rotation[dayOfYear(date) % rotation.length];
}
