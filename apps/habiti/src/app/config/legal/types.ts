/**
 * The shape of a legal document.
 *
 * WHY THESE LIVE IN CODE, AS DATA
 *
 * The same reasoning challenge-catalogue.seed.ts gives for the challenge
 * catalogue — "code-reviewed and pinned to a release, not editable by anyone
 * holding the client-side API token" — applies here at full strength. The
 * Baserow token ships in the client bundle, so a Terms of Service stored in
 * Baserow would be a Terms of Service any user could edit. Git history plus the
 * deploy record is what makes "here is what the Terms said on this date"
 * provable; a mutable row is not.
 *
 * WHY DATA RATHER THAN MARKDOWN OR A TEMPLATE
 *
 * This app has no HTML-injection surface at all: no innerHTML, no
 * DomSanitizer, no markdown renderer, no sanitiser dependency. Adding one for
 * a handful of static, code-reviewed documents would create the app's first
 * XSS path to save some authoring effort. Structured blocks also give two
 * things the alternatives cannot: a deterministic CONTENT HASH for acceptance
 * records, and a block-level DIFF so a user can see what changed between two
 * versions rather than being asked to re-accept blind.
 */

export type LegalDocumentId =
  | 'terms'
  | 'privacy'
  | 'refunds'
  | 'subprocessors'
  | 'cookies'
  | 'health-disclaimer'
  | 'acceptable-use';

/**
 * A closed set. A new kind of block needs a new renderer case, deliberately —
 * that is what stops the document format growing into arbitrary HTML.
 */
export type LegalBlock =
  | { kind: 'heading'; id: string; text: string }
  | { kind: 'paragraph'; id: string; text: string }
  | { kind: 'list'; id: string; items: string[]; ordered?: boolean }
  | { kind: 'definitionList'; id: string; items: { term: string; description: string }[] }
  | { kind: 'callout'; id: string; tone: 'info' | 'warning'; text: string }
  /**
   * An open question for the reviewing lawyer.
   *
   * Renders as a visible amber panel — it is not a code comment, because the
   * point is that a human reading the draft in a browser sees exactly what is
   * unresolved. A document may not be `published` while it contains one, and
   * legal-documents.spec.ts enforces that. This is the mechanical gate between
   * "honest draft" and "live".
   */
  | { kind: 'review'; id: string; question: string; context?: string };

export type LegalDocumentStatus = 'draft' | 'published';

export interface LegalDocument {
  id: LegalDocumentId;
  version: number;
  /** ISO date, YYYY-MM-DD. The date this version takes effect. */
  effectiveFrom: string;
  title: string;
  /** One line, shown in the index and in the version history. */
  summary: string;
  status: LegalDocumentStatus;
  /**
   * Whether accepting an earlier version still counts.
   *
   * MATERIAL means any change to: what personal data is collected; who
   * receives it; the legal basis or purpose; retention; international
   * transfers; user rights or how to exercise them; liability, warranty,
   * indemnity or dispute terms; fees, refunds or renewal; or anything touching
   * Article 9 special-category data.
   *
   * Everything else — typos, reordering, a clarification that narrows nothing —
   * is not material. The distinction matters because campaign_participants
   * resets consent to zero on ANY rule change, which is correct for a campaign
   * between two people and far too blunt here: re-prompting every user for a
   * corrected apostrophe trains them to click through the one that matters.
   */
  material: boolean;
  /** What changed since the previous version. Empty for version 1. */
  changeSummary: string;
  /** sha256 of canonicalJson(blocks). Checked in; the spec recomputes it. */
  contentHash: string;
  blocks: LegalBlock[];
}

/** What the eager registry knows. Deliberately no prose — see registry.ts. */
export interface LegalDocumentSummary {
  id: LegalDocumentId;
  title: string;
  summary: string;
  currentVersion: number;
  effectiveFrom: string;
  contentHash: string;
  status: LegalDocumentStatus;
  /**
   * The oldest version that still counts as accepted. A user is current iff
   * `acceptedVersion >= requiresAcceptanceFrom`.
   *
   * A floor rather than a reset: a material change raises it, an editorial one
   * leaves it alone, and nobody is re-prompted for a typo fix.
   */
  requiresAcceptanceFrom: number;
}

/** Documents a user must accept to use the app. */
export const REQUIRED_DOCUMENT_IDS: readonly LegalDocumentId[] = ['terms', 'privacy'];
