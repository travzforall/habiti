import { LegalDocument, LegalDocumentId } from '../types';
import { ACCEPTABLE_USE_V1 } from './acceptable-use.v1';
import { COOKIES_V1 } from './cookies.v1';
import { HEALTH_DISCLAIMER_V1 } from './health-disclaimer.v1';
import { PRIVACY_V1 } from './privacy.v1';
import { REFUNDS_V1 } from './refunds.v1';
import { SUBPROCESSORS_V1 } from './subprocessors.v1';
import { TERMS_V1 } from './terms.v1';

/**
 * Every version of every legal document, ever.
 *
 * ⚠ IMPORTED ONLY BY THE LAZY LEGAL PAGE. Nothing on the eager path may reach
 * this file — importing it from a service or from app.config.ts would put every
 * word of every document into the initial bundle, which is the same mistake the
 * habit library and skill catalogue each made once before. registry.ts holds the
 * few hundred bytes the rest of the app needs, and legal-registry.spec.ts fails
 * if registry.ts ever imports from here.
 *
 * APPEND-ONLY. A published version is never edited — v2 is a new file next to
 * v1. That is what makes "here is what the Terms said on this date" provable,
 * and it is what the version-diff view compares. Same rule campaign_rule_versions
 * states for campaign rules: "NEVER updated and NEVER deleted."
 */
export const LEGAL_DOCUMENT_VERSIONS: readonly LegalDocument[] = [
  TERMS_V1,
  PRIVACY_V1,
  REFUNDS_V1,
  SUBPROCESSORS_V1,
  COOKIES_V1,
  HEALTH_DISCLAIMER_V1,
  ACCEPTABLE_USE_V1
];

/** Every version of one document, oldest first. */
export function versionsOf(id: LegalDocumentId): LegalDocument[] {
  return LEGAL_DOCUMENT_VERSIONS.filter(doc => doc.id === id).sort(
    (a, b) => a.version - b.version
  );
}

/** One specific version, or undefined. */
export function documentVersion(id: LegalDocumentId, version: number): LegalDocument | undefined {
  return LEGAL_DOCUMENT_VERSIONS.find(doc => doc.id === id && doc.version === version);
}

/** The version in force now — the highest-numbered one. */
export function currentDocument(id: LegalDocumentId): LegalDocument | undefined {
  return versionsOf(id).at(-1);
}
