import { AttachmentKind } from '../models/project.model';

/**
 * Limits, quotas and the byte formatter.
 *
 * ── WHY THESE ARE NOT IN AttachmentUploadService ──────────────────────────
 *
 * AttachmentsService needs the quota, and it is reachable from the eager graph
 * (sync-refreshers.providers.ts registers it, so a user switch clears it). A
 * VALUE import of the upload service from there would drag the whole thing —
 * HttpClient plumbing, the canvas downscaler, the MIME allow-list — into the
 * initial bundle, to read two numbers. The app has around 40 kB of headroom
 * against its budget, and this is exactly how that gets spent without anyone
 * noticing.
 *
 * Constants live here; the machinery stays in the service, which is only
 * reached from the lazy attachment panel. Type-only imports across that line
 * are free and are fine.
 */

/**
 * Per-file ceilings, in bytes.
 *
 * PRODUCT limits, not the server's. The instance accepted a 30 MB upload when
 * probed, so what constrains these is what is reasonable to push from a phone
 * with no resumable upload and no transcoding — not what Baserow would take.
 */
export const MAX_BYTES: Record<AttachmentKind, number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  link: 0
};

/** Total storage per account. */
export const QUOTA_BYTES = { free: 250 * 1024 * 1024, plus: 5 * 1024 * 1024 * 1024 };

/**
 * What may be attached, by MIME type.
 *
 * An ALLOW-list, and a refusal by name when something is not on it. A
 * deny-list would silently accept the next format nobody thought about.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip'
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
