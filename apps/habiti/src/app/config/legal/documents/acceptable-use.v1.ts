import { LegalDocument } from '../types';

/**
 * Acceptable Use, version 1. DRAFT.
 *
 * Needed because Habiti is not a solitary app: friend invites are addressed by
 * EMAIL, so a user can reach someone who has never heard of Habiti, and shared
 * challenges expose one person's check-in dates to another. When a recovery
 * challenge is the thing being shared, "do not repeat what you see here" stops
 * being etiquette.
 */
export const ACCEPTABLE_USE_V1: LegalDocument = {
  id: 'acceptable-use',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Acceptable Use',
  summary: 'What is expected of you around other people on Habiti.',
  status: 'draft',
  material: false,
  changeSummary: '',
  contentHash: '81de1b0a365d2d92825021905e5836efa74474a2be28a66329aef4912d4a42d6',
  blocks: [
    { kind: 'heading', id: 'h-intro', text: 'Other people' },
    {
      kind: 'paragraph',
      id: 'p-intro',
      text: 'Most of Habiti is between you and yourself. The parts that are not — friend invites and shared challenges — involve someone who may be tracking something they find hard to talk about. These rules exist for them.'
    },

    { kind: 'heading', id: 'h-invites', text: 'Invitations' },
    {
      kind: 'list',
      id: 'l-invites',
      items: [
        'Only invite people you actually know and who would expect to hear from you.',
        'Do not invite an address you found somewhere, and do not invite people in bulk.',
        'If someone declines, leave it there.'
      ]
    },

    { kind: 'heading', id: 'h-shared', text: 'What you learn about someone else' },
    {
      kind: 'callout',
      id: 'c-confidence',
      tone: 'warning',
      text: 'If someone shares a challenge with you, what you see is told to you in confidence. Do not repeat it, screenshot it, or bring it up with anyone else. Someone else\'s recovery is not your news.'
    },
    {
      kind: 'list',
      id: 'l-shared',
      items: [
        'Do not pressure anyone about a missed day.',
        'Do not use what you see to shame, threaten or manipulate.',
        'If you are worried about someone, talk to them, not about them.'
      ]
    },

    { kind: 'heading', id: 'h-general', text: 'Generally' },
    {
      kind: 'list',
      id: 'l-general',
      items: [
        'Do not impersonate anyone.',
        'Do not upload anything illegal, or anything you do not have the right to upload.',
        'Do not try to break, overload or get around the security of the service.',
        'Do not use Habiti to collect other people\'s information.'
      ]
    },

    { kind: 'heading', id: 'h-enforce', text: 'If these are broken' },
    {
      kind: 'paragraph',
      id: 'p-enforce',
      text: 'We may suspend or close an account that breaks these rules or puts another user at risk. Tell us if someone is treating you badly on Habiti.'
    },
    {
      kind: 'review',
      id: 'review-reporting',
      question: 'How does a user actually report someone, and who handles it?',
      context:
        'There is no reporting UI, no moderation tooling and no staff console in the app. Until there is, this has to be an email address with a person behind it — do not promise a process that does not exist.'
    }
  ]
};
