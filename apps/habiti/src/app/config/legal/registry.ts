import { LegalDocumentId, LegalDocumentSummary } from './types';

/**
 * The eager index of legal documents.
 *
 * ⚠ THIS FILE MUST NEVER IMPORT FROM ./documents.
 *
 * Registration, the re-acceptance check and the footer links all need to know
 * WHICH documents exist and which version is current. None of them needs a
 * single word of the prose. Keeping the two apart is what stops seven documents
 * landing in the initial bundle — the same leak the habit library (+137 kB) and
 * the skill catalogue (+120 kB) each caused once, and which the app now has
 * only ~43 kB of headroom to absorb.
 *
 * `legal-registry.spec.ts` reads this file as TEXT and fails if a
 * `./documents` import ever appears, because a typecheck cannot see the
 * difference and a code review will not notice it twice.
 *
 * The hashes below are duplicated from the document files, and the spec asserts
 * they match. That duplication is deliberate: it is what lets this file stay
 * prose-free while still being able to identify exactly which text a user
 * accepted.
 */
export const LEGAL_INDEX: Record<LegalDocumentId, LegalDocumentSummary> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    summary: 'The agreement between you and Habiti.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: 'bbc304b4b22d641a6d362b4a2b2c55e789e2dfe8c563a4a2d70e0f9a86ebaa24',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'What Habiti collects, why, who else sees it, and what you can ask us to do.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '40443c76c49ddb8934c0789d58a3d311915ea3f14e4f0dd419bd4812747e8457',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  refunds: {
    id: 'refunds',
    title: 'Refunds',
    summary: 'Habiti does not currently charge for anything.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '538cde0ba30b4b6d6c7ea6e75a21530209575f4764118ee27a530f965338ff4b',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  subprocessors: {
    id: 'subprocessors',
    title: 'Subprocessors',
    summary: 'The suppliers that process data on our behalf.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '69d6bc07cab8e91e60f45509a58a1c9037da752164129a21eb908146766a14f4',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  cookies: {
    id: 'cookies',
    title: 'Cookies and Storage',
    summary: 'Habiti sets no cookies. Here is what it does use.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '233035fc64397fb40ea929f77fc2697a2fe661e720133b76a354b4cdeca13254',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  'health-disclaimer': {
    id: 'health-disclaimer',
    title: 'Health and Wellbeing',
    summary: 'Habiti is a tracking tool, not treatment. Please read this one.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '7274ace2b8c94a8b3f5acf0b780bf7eae529461b6bf8057f83928ac63e0b99da',
    status: 'draft',
    requiresAcceptanceFrom: 1
  },
  'acceptable-use': {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    summary: 'What is expected of you around other people on Habiti.',
    currentVersion: 1,
    effectiveFrom: '2026-08-14',
    contentHash: '81de1b0a365d2d92825021905e5836efa74474a2be28a66329aef4912d4a42d6',
    status: 'draft',
    requiresAcceptanceFrom: 1
  }
};

/** In the order they should be listed. */
export const LEGAL_DOCUMENT_ORDER: readonly LegalDocumentId[] = [
  'terms',
  'privacy',
  'health-disclaimer',
  'acceptable-use',
  'cookies',
  'subprocessors',
  'refunds'
];

export function legalSummary(id: LegalDocumentId): LegalDocumentSummary {
  return LEGAL_INDEX[id];
}

/** The route for a document, or a specific version of it. */
export function legalRoute(id: LegalDocumentId, version?: number): string {
  return version === undefined ? `/legal/${id}` : `/legal/${id}/v/${version}`;
}
