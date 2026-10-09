import { SupplyKind } from '../config/supply-catalogue';
import { SupplyOverride } from '../config/supply-library';
import { ToolStatus } from '../config/tool-cost';
import { BaserowSelect, parseTags, selectValue, serializeTags } from './task-row.models';

/**
 * Rows of `user_supplies` (41): what one person changed about the built-in
 * list. See config/supply-library.ts for why these are overrides and not
 * copies of the catalogue.
 */

export interface UserSupplyRow {
  id: number;
  title?: string;
  user_id?: string;
  catalogue_id?: string | null;
  kind?: string | BaserowSelect | null;
  category?: string | null;
  unit?: string | null;
  sizes?: string | null;
  default_status?: string | BaserowSelect | null;
  default_cost?: number | string | null;
  hidden?: boolean;
  favourite?: boolean;
  url?: string | null;
  sku?: string | null;
  note?: string | null;
}

export const USER_SUPPLY_COLUMNS = [
  'title',
  'user_id',
  'catalogue_id',
  'kind',
  'category',
  'unit',
  'sizes',
  'default_status',
  'default_cost',
  'hidden',
  'favourite',
  'url',
  'sku',
  'note'
] as const;

const KINDS: readonly SupplyKind[] = ['tool', 'material'];
const STATUSES: readonly ToolStatus[] = ['own', 'borrow', 'hire', 'buy'];

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toSupplyOverride(row: UserSupplyRow): SupplyOverride {
  const kind = selectValue(row.kind);
  const status = selectValue(row.default_status);

  return {
    id: String(row.id),
    catalogueId: row.catalogue_id || undefined,
    title: row.title || undefined,
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as SupplyKind) : undefined,
    category: row.category || undefined,
    unit: row.unit || undefined,
    sizes: row.sizes ? parseTags(row.sizes) : undefined,
    defaultStatus: (STATUSES as readonly string[]).includes(status)
      ? (status as ToolStatus)
      : undefined,
    defaultCost: numberOrUndefined(row.default_cost),
    hidden: row.hidden ?? undefined,
    favourite: row.favourite ?? undefined,
    url: row.url || undefined,
    sku: row.sku || undefined,
    note: row.note || undefined
  };
}

export function fromSupplyOverride(
  override: SupplyOverride,
  userId: string
): Record<string, unknown> {
  return {
    title: override.title ?? '',
    user_id: userId,
    catalogue_id: override.catalogueId ?? '',
    // A select rejects '', so an unset one must be null.
    kind: override.kind ?? null,
    category: override.category ?? '',
    unit: override.unit ?? '',
    sizes: serializeTags(override.sizes),
    default_status: override.defaultStatus ?? null,
    default_cost: override.defaultCost ?? null,
    hidden: override.hidden ?? false,
    favourite: override.favourite ?? false,
    url: override.url ?? '',
    sku: override.sku ?? '',
    note: override.note ?? ''
  };
}
