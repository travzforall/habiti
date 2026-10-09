import { Attachment, AttachmentKind, ChecklistItem } from './project.model';
import { BaserowSelect, parseDateTimeValue, selectValue, toDateTime } from './task-row.models';

/**
 * Mapping for `task_attachments` (schema 31) and `task_checklist_items`
 * (schema 32).
 *
 * The column lists here are checked against those schema files by
 * `scripts/check-baserow-fields.mjs`. See the long note at the top of
 * task-row.models.ts for what that check is protecting against — in short,
 * Baserow silently drops a column name it does not recognise, so a rename that
 * only lands in one of the two places loses data without failing anything.
 */

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface AttachmentRow {
  id: number;
  title?: string;
  user_id?: string;
  parent_type?: string | BaserowSelect;
  parent_id?: string;
  kind?: string | BaserowSelect;
  url?: string;
  thumbnail_url?: string | null;
  mime_type?: string | null;
  size_bytes?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  caption?: string | null;
  baserow_name?: string | null;
  uploaded_at?: string | null;
}

/** `uploaded_at` is Baserow's own created-on type: read, never written. */
export const ATTACHMENT_COLUMNS = [
  'title',
  'user_id',
  'parent_type',
  'parent_id',
  'kind',
  'url',
  'thumbnail_url',
  'mime_type',
  'size_bytes',
  'width',
  'height',
  'caption',
  'baserow_name'
] as const;

const ATTACHMENT_KINDS: readonly AttachmentKind[] = ['image', 'video', 'document', 'link'];

export function toAttachment(row: AttachmentRow): Attachment {
  const kind = selectValue(row.kind);

  return {
    id: String(row.id),
    parentType: selectValue(row.parent_type) === 'project' ? 'project' : 'task',
    parentId: row.parent_id ?? '',
    kind: (ATTACHMENT_KINDS as readonly string[]).includes(kind)
      ? (kind as AttachmentKind)
      : 'document',
    filename: row.title ?? '',
    url: row.url ?? '',
    thumbnailUrl: row.thumbnail_url || undefined,
    mimeType: row.mime_type || undefined,
    size: numberOr(row.size_bytes, 0),
    width: numberOrUndefined(row.width),
    height: numberOrUndefined(row.height),
    caption: row.caption || undefined,
    baserowName: row.baserow_name || undefined,
    uploadedAt: parseDateTimeValue(row.uploaded_at) ?? new Date()
  };
}

export function fromAttachment(attachment: Attachment, userId: string): Record<string, unknown> {
  return {
    title: attachment.filename,
    user_id: userId,
    parent_type: attachment.parentType,
    parent_id: attachment.parentId,
    kind: attachment.kind,
    url: attachment.url,
    thumbnail_url: attachment.thumbnailUrl ?? '',
    mime_type: attachment.mimeType ?? '',
    size_bytes: attachment.size ?? 0,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
    caption: attachment.caption ?? '',
    baserow_name: attachment.baserowName ?? ''
  };
}

// ---------------------------------------------------------------------------
// Checklist items
// ---------------------------------------------------------------------------

export interface ChecklistRow {
  id: number;
  title?: string;
  user_id?: string;
  task_id?: string;
  completed?: boolean;
  completed_at?: string | null;
  sort_order?: number | string | null;
}

export const CHECKLIST_COLUMNS = [
  'title',
  'user_id',
  'task_id',
  'completed',
  'completed_at',
  'sort_order'
] as const;

export function toChecklistItem(row: ChecklistRow): ChecklistItem {
  return {
    id: String(row.id),
    taskId: row.task_id ?? '',
    title: row.title ?? '',
    completed: row.completed ?? false,
    sortOrder: numberOr(row.sort_order, 0),
    completedAt: parseDateTimeValue(row.completed_at)
  };
}

export function fromChecklistItem(item: ChecklistItem, userId: string): Record<string, unknown> {
  return {
    title: item.title,
    user_id: userId,
    task_id: item.taskId,
    completed: item.completed,
    completed_at: toDateTime(item.completedAt),
    sort_order: item.sortOrder ?? 0
  };
}

// ---------------------------------------------------------------------------

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberOr(value: number | string | null | undefined, fallback: number): number {
  return numberOrUndefined(value) ?? fallback;
}
