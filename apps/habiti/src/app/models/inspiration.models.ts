import {
  BaserowSelect,
  parseDateTimeValue,
  parseTags,
  selectValue,
  serializeTags
} from './task-row.models';

/**
 * Inspiration boards: the things you keep because they make you want to do the
 * work. A YouTube video, a photograph, a link, a line of text.
 *
 * NOT the same thing as `app-daily-inspiration`, which rotates a quote on the
 * dashboard once a day. That one is content Habiti gives you; this is content
 * you keep.
 */

export type InspirationKind = 'video' | 'image' | 'link' | 'note';
export type MediaProvider = 'youtube' | 'vimeo' | 'image' | 'web';

/** The board an item belongs to: `personal`, or a `user_projects` row id. */
export const PERSONAL_BOARD = 'personal';

export interface InspirationItem {
  id: string;
  board: string;
  kind: InspirationKind;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  provider?: MediaProvider;
  /** The video id, when there is one. Kept so a thumbnail can be rebuilt. */
  sourceId?: string;
  note?: string;
  tags: string[];
  sortOrder: number;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Baserow mapping — table 33, `inspiration_items`
// ---------------------------------------------------------------------------

export interface InspirationRow {
  id: number;
  title?: string;
  user_id?: string;
  board?: string;
  kind?: string | BaserowSelect;
  url?: string | null;
  thumbnail_url?: string | null;
  provider?: string | null;
  source_id?: string | null;
  note?: string | null;
  tags?: string | null;
  sort_order?: number | string | null;
  created_at?: string | null;
}

/** `created_at` is Baserow's own created-on type: read, never written. */
export const INSPIRATION_COLUMNS = [
  'title',
  'user_id',
  'board',
  'kind',
  'url',
  'thumbnail_url',
  'provider',
  'source_id',
  'note',
  'tags',
  'sort_order'
] as const;

const KINDS: readonly InspirationKind[] = ['video', 'image', 'link', 'note'];

export function toInspirationItem(row: InspirationRow): InspirationItem {
  const kind = selectValue(row.kind);

  return {
    id: String(row.id),
    board: row.board?.trim() || PERSONAL_BOARD,
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as InspirationKind) : 'link',
    title: row.title ?? '',
    url: row.url || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    provider: (row.provider as MediaProvider) || undefined,
    sourceId: row.source_id || undefined,
    note: row.note || undefined,
    tags: parseTags(row.tags),
    sortOrder: Number(row.sort_order ?? 0) || 0,
    createdAt: parseDateTimeValue(row.created_at) ?? new Date()
  };
}

export function fromInspirationItem(
  item: InspirationItem,
  userId: string
): Record<string, unknown> {
  return {
    title: item.title,
    user_id: userId,
    board: item.board || PERSONAL_BOARD,
    kind: item.kind,
    url: item.url ?? '',
    thumbnail_url: item.thumbnailUrl ?? '',
    provider: item.provider ?? '',
    source_id: item.sourceId ?? '',
    note: item.note ?? '',
    tags: serializeTags(item.tags),
    sort_order: item.sortOrder ?? 0
  };
}
