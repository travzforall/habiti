import { LegalDocumentId } from '../config/legal/types';

/**
 * What a user agreed to, and when.
 *
 * One shape for four things, distinguished by `kind` — a consent is an
 * acceptance with a scope. Splitting Article 9 consent into its own model
 * would mean two round-trips and two places to look when answering the one
 * question this exists to answer: what has this person agreed to?
 */

/** The four Article 9 categories this app can collect. */
export type SensitiveCategory = 'health' | 'mental_health' | 'sobriety' | 'religion';

export type ConsentKind =
  /** Accepted a version of Terms or Privacy. */
  | 'document_acceptance'
  /** Article 9(2)(a) explicit consent to store sensitive habits of one category. */
  | 'special_category'
  /** Consent to show sensitive check-ins to named challenge partners. */
  | 'campaign_share'
  /** Express request to start a paid digital service inside the withdrawal period. Unused; there is no billing. */
  | 'withdrawal_waiver';

export type ConsentSurface =
  | 'registration'
  | 'reacceptance_gate'
  | 'habit_add'
  | 'campaign_join'
  | 'settings'
  | 'checkout';

export interface ConsentRecord {
  /** Client-generated, `cns_` prefixed so these are greppable in a log. */
  id: string;
  userId: string;
  kind: ConsentKind;

  /** Set only for document_acceptance. */
  documentId?: LegalDocumentId;
  documentVersion?: number;
  /**
   * The hash of the exact text agreed to.
   *
   * A version number alone is not enough: if v1's words were ever edited,
   * every record pointing at "v1" would silently start meaning something else.
   */
  contentHash?: string;

  /** Article 9 category, or a campaign key. Empty for document acceptance. */
  scope?: string;

  /** False records an explicit refusal, which is worth keeping — see the schema notes. */
  accepted: boolean;
  acceptedAt: string;
  /** Set when withdrawn. The record is closed, never deleted (Article 7(3)). */
  withdrawnAt?: string;

  surface: ConsentSurface;

  /**
   * Provenance.
   *
   * Every row written today is 'client', and a client-written row is forgeable
   * — the Baserow token ships in the bundle, so anyone can write one, including
   * one for somebody else. Recording this now is what will let the trustworthy
   * rows be told apart once the API writes them; it cannot be reconstructed
   * afterwards.
   */
  writtenBy: 'client' | 'api';

  rowId?: number;
}

/** The Baserow row shape. snake_case, flat, JSON-free. */
export interface ConsentRow {
  id?: number;
  user_id: string;
  consent_kind: ConsentKind;
  document_id?: string;
  document_version?: number | null;
  content_hash?: string;
  scope?: string;
  accepted: boolean;
  accepted_at: string;
  withdrawn_at?: string | null;
  ui_surface?: ConsentSurface;
  written_by: 'client' | 'api';
  app_version?: string;
}

/**
 * Returns `Record<string, unknown>` rather than `ConsentRow`, matching
 * fromSkillTrack: an interface is not assignable to Record<string, unknown>
 * (it could be augmented later), and that is what the generic row helpers take.
 */
/**
 * Every column toConsentRow writes.
 *
 * This one matters more than most. A dropped column here does not lose a
 * preference — it loses part of the record of what somebody agreed to, while
 * the write still returns 200 and the app still shows the consent as captured.
 * `npm run verify:fields` compares this list with the schema file; the spec
 * beside this file compares it with the mapper.
 */
export const CONSENT_COLUMNS = [
  'user_id',
  'consent_kind',
  'document_id',
  'document_version',
  'content_hash',
  'scope',
  'accepted',
  'accepted_at',
  'withdrawn_at',
  'ui_surface',
  'written_by',
  'app_version'
] as const;

export function toConsentRow(record: ConsentRecord, appVersion: string): Record<string, unknown> {
  return {
    user_id: record.userId,
    consent_kind: record.kind,
    document_id: record.documentId ?? '',
    document_version: record.documentVersion ?? null,
    content_hash: record.contentHash ?? '',
    scope: record.scope ?? '',
    accepted: record.accepted,
    accepted_at: record.acceptedAt,
    withdrawn_at: record.withdrawnAt ?? null,
    ui_surface: record.surface,
    written_by: record.writtenBy,
    app_version: appVersion
  };
}

export function fromConsentRow(row: ConsentRow): ConsentRecord {
  return {
    id: `cns_row_${row.id}`,
    userId: String(row.user_id),
    kind: row.consent_kind,
    documentId: (row.document_id || undefined) as LegalDocumentId | undefined,
    documentVersion: row.document_version ?? undefined,
    contentHash: row.content_hash || undefined,
    scope: row.scope || undefined,
    // Baserow returns booleans faithfully, but a missing column reads as
    // undefined and "undefined consent" must never mean "accepted".
    accepted: row.accepted === true,
    acceptedAt: row.accepted_at,
    withdrawnAt: row.withdrawn_at ?? undefined,
    surface: row.ui_surface ?? 'registration',
    writtenBy: row.written_by ?? 'client',
    rowId: row.id
  };
}

export function newConsentId(): string {
  return `cns_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Live means accepted and not withdrawn. */
export function isLive(record: ConsentRecord): boolean {
  return record.accepted && !record.withdrawnAt;
}
