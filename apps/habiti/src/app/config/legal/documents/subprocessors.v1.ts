import { LegalDocument } from '../types';

/**
 * Subprocessors, version 1. DRAFT.
 *
 * THIS IS THE REAL "DPA" DELIVERABLE FOR A CONSUMER PRODUCT. Habiti decides
 * why and how personal data is processed, which makes it a CONTROLLER.
 * Controllers do not publish data processing agreements — they sign their
 * suppliers'. What a controller publishes is who those suppliers are, so that
 * users (and regulators) can see the chain.
 *
 * A published DPA would only be needed if Habiti later processed data on
 * someone else's behalf, e.g. a gym licensing it for its members.
 *
 * The list below is derived from every external host the code actually
 * contacts. It is deliberately short because the app genuinely has very few
 * dependencies: no analytics, no advertising, no error reporting, no email.
 */
export const SUBPROCESSORS_V1: LegalDocument = {
  id: 'subprocessors',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Subprocessors',
  summary: 'The suppliers that process data on our behalf.',
  status: 'draft',
  material: true,
  changeSummary: '',
  contentHash: '69d6bc07cab8e91e60f45509a58a1c9037da752164129a21eb908146766a14f4',
  blocks: [
    { kind: 'heading', id: 'h-intro', text: 'Who we rely on' },
    {
      kind: 'paragraph',
      id: 'p-intro',
      text: 'Running Habiti needs a few suppliers. They process your data only on our instructions and for no purpose of their own. This is the complete list.'
    },
    {
      kind: 'definitionList',
      id: 'dl-list',
      items: [
        {
          term: 'Xano — accounts and sign-in',
          description:
            'Holds your email address, name, username and date of birth, and issues the token that keeps you signed in.'
        },
        {
          term: 'Baserow — the application database',
          description:
            'Holds everything you track: habits, entries, notes, moods, photos, challenges, friendships and progress.'
        },
        {
          term: 'Netlify — hosting',
          description:
            'Serves the Habiti web app to your browser. Sees your IP address in its server logs as part of doing so.'
        }
      ]
    },

    {
      kind: 'review',
      id: 'review-regions',
      question: 'Add the country or region each supplier stores data in.',
      context:
        'Article 13(1)(f) requires transfer disclosures. The Xano workspace region is not recorded anywhere in the codebase, and the Baserow instance is self-hosted with no infrastructure config checked in. Neither can be guessed.'
    },
    {
      kind: 'review',
      id: 'review-baserow-operator',
      question: 'Who legally operates the Baserow instance?',
      context:
        'It runs on a jollycares.com subdomain. If that is a separate legal entity from the one that contracts with users, it is a processor and needs a signed Article 28 agreement with documented security measures. If it is the same entity, no agreement is needed but it must still appear in the record of processing. This is probably the most important open question in the whole set.'
    },
    {
      kind: 'review',
      id: 'review-signed-dpas',
      question: 'Confirm a signed DPA and transfer safeguards are in place for each supplier.',
      context:
        'Habiti signs theirs; it does not publish its own. Standard contractual clauses or an adequacy decision will be needed for anything outside the user\'s region.'
    },

    { kind: 'heading', id: 'h-not-used', text: 'What we do not use' },
    {
      kind: 'paragraph',
      id: 'p-not-used',
      text: 'We have no analytics provider, no advertising network, no crash or error reporting service, and no email provider — Habiti sends no email at all. If any of that changes, this page changes first and we will tell you.'
    },

    { kind: 'heading', id: 'h-changes', text: 'Changes' },
    {
      kind: 'paragraph',
      id: 'p-changes',
      text: 'Adding a supplier is a material change: this page is versioned like every other document here, and you can compare any version against the one before it.'
    }
  ]
};
