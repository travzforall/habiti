import { BaserowSelect, parseDateOnly, selectValue, toDateOnly } from './task-row.models';

/**
 * The user's standing kit — what they own and rely on, independent of any job.
 *
 * WHY THIS IS NOT ProjectItem OR ProjectTool. Those are per-job rows: "this
 * kitchen needs 4 litres of primer". They are created for a project and die
 * with it. This is the catalogue they are created FROM — the drill you already
 * own, the Figma seat you pay for, the diagram you keep going back to.
 *
 * The relationship is COPY, not link. Adding a toolkit item to a project
 * creates a project row prefilled from this one, and the two then diverge on
 * purpose: a job records what IT needed, at the price IT paid. Editing your
 * catalogue afterwards must not rewrite the history of a finished job.
 */
export type ToolkitKind = 'tool' | 'equipment' | 'material' | 'software' | 'reference' | 'other';

/**
 * Availability, not condition.
 *
 * `need` and `broken` are the two a shopping list is built from, which is why
 * they are states here rather than a separate "wanted" flag.
 */
export type ToolkitStatus = 'have' | 'need' | 'ordered' | 'loaned_out' | 'broken';

export const TOOLKIT_KINDS: readonly ToolkitKind[] = [
  'tool',
  'equipment',
  'material',
  'software',
  'reference',
  'other'
] as const;

export const TOOLKIT_STATUSES: readonly ToolkitStatus[] = [
  'have',
  'need',
  'ordered',
  'loaned_out',
  'broken'
] as const;

export interface ToolkitKindMeta {
  id: ToolkitKind;
  label: string;
  icon: string;
  /** One line on what belongs here, shown in the picker. */
  hint: string;
  /** False for kinds where quantity and cost are noise. */
  costed: boolean;
  /** True when it is used up rather than kept. */
  consumable: boolean;
}

export const TOOLKIT_KIND_META: Record<ToolkitKind, ToolkitKindMeta> = {
  tool: {
    id: 'tool',
    label: 'Tool',
    icon: '🔧',
    hint: 'Used and kept. A drill, a wrench.',
    costed: true,
    consumable: false
  },
  equipment: {
    id: 'equipment',
    label: 'Equipment',
    icon: '🏋️',
    hint: 'Bigger kit you own. A barbell, a printer.',
    costed: true,
    consumable: false
  },
  material: {
    id: 'material',
    label: 'Material',
    icon: '📦',
    hint: 'Used up. Primer, screws, sandpaper.',
    costed: true,
    consumable: true
  },
  software: {
    id: 'software',
    label: 'Software',
    icon: '💻',
    hint: 'A seat or licence, usually recurring.',
    costed: true,
    consumable: false
  },
  reference: {
    id: 'reference',
    label: 'Reference',
    icon: '📚',
    hint: 'A doc, a diagram, a link you keep returning to.',
    costed: false,
    consumable: false
  },
  other: {
    id: 'other',
    label: 'Other',
    icon: '🧰',
    hint: 'Anything that does not fit the rest.',
    costed: true,
    consumable: false
  }
};

export interface ToolkitStatusMeta {
  id: ToolkitStatus;
  label: string;
  icon: string;
  /** True when this status means the thing is usable right now. */
  available: boolean;
  /** True when it belongs on a shopping list. */
  wanted: boolean;
}

export const TOOLKIT_STATUS_META: Record<ToolkitStatus, ToolkitStatusMeta> = {
  have: { id: 'have', label: 'Have it', icon: '✅', available: true, wanted: false },
  need: { id: 'need', label: 'Need it', icon: '🛒', available: false, wanted: true },
  ordered: { id: 'ordered', label: 'Ordered', icon: '🚚', available: false, wanted: false },
  loaned_out: { id: 'loaned_out', label: 'Loaned out', icon: '🤝', available: false, wanted: false },
  broken: { id: 'broken', label: 'Broken', icon: '💥', available: false, wanted: true }
};

/** App-domain shape: string id, Date, camelCase. */
export interface ToolkitItem {
  id: string;
  userId: string;
  title: string;
  kind: ToolkitKind;
  status: ToolkitStatus;
  icon?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  currency?: string;
  supplier?: string;
  url?: string;
  location?: string;
  purchasedOn?: Date;
  renewsOn?: Date;
  /** Habit-library slugs this kit supports. */
  linkedHabitIds: string[];
  note?: string;
  archived: boolean;
  sortOrder?: number;
}

/** Baserow row shape: numeric id, snake_case, selects possibly objects. */
export interface ToolkitItemRow {
  id: number;
  title?: string;
  user_id?: string;
  kind?: string | BaserowSelect | null;
  status?: string | BaserowSelect | null;
  icon?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  currency?: string | null;
  supplier?: string | null;
  url?: string | null;
  location?: string | null;
  purchased_on?: string | null;
  renews_on?: string | null;
  linked_habit_ids?: string | null;
  note?: string | null;
  archived?: boolean | null;
  sort_order?: number | string | null;
}

/** Baserow numbers arrive as strings often enough to parse defensively. */
function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toKind(value: string | BaserowSelect | null | undefined): ToolkitKind {
  const raw = selectValue(value ?? undefined);
  return (TOOLKIT_KINDS as readonly string[]).includes(raw) ? (raw as ToolkitKind) : 'tool';
}

function toStatus(value: string | BaserowSelect | null | undefined): ToolkitStatus {
  const raw = selectValue(value ?? undefined);
  return (TOOLKIT_STATUSES as readonly string[]).includes(raw) ? (raw as ToolkitStatus) : 'have';
}

/** Comma separated, matching the `depends_on` convention on user_tasks. */
export function parseHabitIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export function toToolkitItem(row: ToolkitItemRow): ToolkitItem {
  return {
    id: String(row.id),
    userId: row.user_id ?? '',
    title: row.title ?? '',
    kind: toKind(row.kind),
    status: toStatus(row.status),
    icon: row.icon || undefined,
    quantity: toNumber(row.quantity),
    unit: row.unit || undefined,
    unitCost: toNumber(row.unit_cost),
    currency: row.currency || undefined,
    supplier: row.supplier || undefined,
    url: row.url || undefined,
    location: row.location || undefined,
    purchasedOn: parseDateOnly(row.purchased_on),
    renewsOn: parseDateOnly(row.renews_on),
    linkedHabitIds: parseHabitIds(row.linked_habit_ids),
    note: row.note || undefined,
    archived: !!row.archived,
    sortOrder: toNumber(row.sort_order)
  };
}

/**
 * The write shape.
 *
 * `id` is deliberately absent — Baserow assigns it, and sending one is how a
 * create silently becomes a no-op.
 */
export function fromToolkitItem(item: ToolkitItem, userId: string): Record<string, unknown> {
  return {
    title: item.title,
    user_id: userId,
    kind: item.kind,
    status: item.status,
    icon: item.icon ?? '',
    quantity: item.quantity ?? null,
    unit: item.unit ?? '',
    unit_cost: item.unitCost ?? null,
    currency: item.currency ?? 'GBP',
    supplier: item.supplier ?? '',
    url: item.url ?? '',
    location: item.location ?? '',
    purchased_on: toDateOnly(item.purchasedOn),
    renews_on: toDateOnly(item.renewsOn),
    linked_habit_ids: item.linkedHabitIds.join(','),
    note: item.note ?? '',
    archived: item.archived,
    sort_order: item.sortOrder ?? null
  };
}

export function iconFor(item: Pick<ToolkitItem, 'icon' | 'kind'>): string {
  return item.icon?.trim() || TOOLKIT_KIND_META[item.kind].icon;
}

export interface ToolkitSummary {
  total: number;
  available: number;
  /** Things to buy or replace — `need` plus `broken`. */
  wanted: number;
  /** Sum of quantity × unitCost across costed, non-archived kinds. */
  value: number;
  /** What the wanted ones would cost to put right. */
  wantedValue: number;
  byKind: Record<ToolkitKind, number>;
}

/**
 * Rolls a list up for the dashboard card and the page header.
 *
 * Quantity defaults to 1, not 0: an item with a cost and no quantity is one of
 * them, and treating it as zero would silently value a whole kit at nothing.
 */
export function summarise(items: readonly ToolkitItem[]): ToolkitSummary {
  const live = items.filter(item => !item.archived);

  const byKind = TOOLKIT_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = live.filter(item => item.kind === kind).length;
      return acc;
    },
    {} as Record<ToolkitKind, number>
  );

  const valueOf = (item: ToolkitItem) =>
    TOOLKIT_KIND_META[item.kind].costed ? (item.unitCost ?? 0) * (item.quantity ?? 1) : 0;

  return {
    total: live.length,
    available: live.filter(item => TOOLKIT_STATUS_META[item.status].available).length,
    wanted: live.filter(item => TOOLKIT_STATUS_META[item.status].wanted).length,
    value: live.reduce((sum, item) => sum + valueOf(item), 0),
    wantedValue: live
      .filter(item => TOOLKIT_STATUS_META[item.status].wanted)
      .reduce((sum, item) => sum + valueOf(item), 0),
    byKind
  };
}

/**
 * A toolkit item as a project item draft.
 *
 * Copy, not link — see the note at the top. Quantity is deliberately NOT
 * carried over: how many you own says nothing about how many this job needs.
 */
export function toProjectItemDraft(item: ToolkitItem): {
  title: string;
  unit?: string;
  unitCost?: number;
  currency?: string;
  supplier?: string;
  url?: string;
  note?: string;
} {
  return {
    title: item.title,
    unit: item.unit,
    unitCost: item.unitCost,
    currency: item.currency,
    supplier: item.supplier,
    url: item.url,
    note: item.note
  };
}
