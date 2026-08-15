import { LegalDocument } from '../types';

/**
 * Terms of Service, version 1. DRAFT.
 *
 * For a consumer product THIS IS THE MASTER AGREEMENT. There is no separate
 * MSA — that is a business-to-business instrument — so everything an MSA would
 * carry is here as named sections: term, liability, warranties, indemnity, IP,
 * suspension, change control and disputes.
 */
export const TERMS_V1: LegalDocument = {
  id: 'terms',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Terms of Service',
  summary: 'The agreement between you and Habiti.',
  status: 'draft',
  material: true,
  changeSummary: '',
  contentHash: 'bbc304b4b22d641a6d362b4a2b2c55e789e2dfe8c563a4a2d70e0f9a86ebaa24',
  blocks: [
    {
      kind: 'review',
      id: 'review-entity',
      question: 'Which legal entity contracts with the user, and where is it registered?',
      context:
        'Needed for the parties clause, the governing law clause and the notices address. Also confirm the right to trade as "Habiti".'
    },
    {
      kind: 'review',
      id: 'review-law',
      question: 'Governing law and forum.',
      context:
        'The instruction was to write to the strictest standard (EU/UK), but the governing law clause itself needs a jurisdiction. Note that a consumer cannot be deprived of the protections of their home country regardless of what this says.'
    },

    { kind: 'heading', id: 'h-intro', text: 'These terms' },
    {
      kind: 'paragraph',
      id: 'p-intro',
      text: 'These are the terms on which you may use Habiti. By creating an account you agree to them. If you do not agree, do not create an account. We have tried to write them in plain language; where they are unavoidably formal, that is because they have to be.'
    },

    { kind: 'heading', id: 'h-eligibility', text: 'Who can use Habiti' },
    {
      kind: 'paragraph',
      id: 'p-eligibility',
      text: 'You must be at least 18 years old. You must give us accurate details when you sign up, and keep your password to yourself. You are responsible for what happens on your account.'
    },

    { kind: 'heading', id: 'h-what', text: 'What Habiti is, and what it is not' },
    {
      kind: 'callout',
      id: 'c-not-medical',
      tone: 'warning',
      text: 'Habiti is a tracking tool, not a health service. It is not medical, psychological or addiction-treatment advice, and it is not a substitute for a professional. Our Health and Wellbeing notice says more, and it matters — please read it.'
    },
    {
      kind: 'paragraph',
      id: 'p-what',
      text: 'Habiti records what you tell it and shows it back to you. It does not verify anything. A streak, a level or a completed challenge is a record of what you entered, not proof that anything happened.'
    },

    { kind: 'heading', id: 'h-money', text: 'Pledges and money' },
    {
      kind: 'callout',
      id: 'c-money',
      tone: 'warning',
      text: 'Habiti records agreements. It never holds or transfers money. If you stake something on a challenge and miss it, you give directly to the charity yourself and mark it in the app; the other person confirms it. Nothing passes through us, and we cannot enforce, recover or refund it. Only stake with people you trust.'
    },

    { kind: 'heading', id: 'h-conduct', text: 'How you must behave' },
    {
      kind: 'paragraph',
      id: 'p-conduct',
      text: 'Habiti connects you with other people, some of whom may be tracking things they find difficult to talk about. Our Acceptable Use notice sets out what is expected. In short: do not invite people who have not asked to hear from you, do not share what you learn about someone else, and do not use Habiti to harass anyone.'
    },

    { kind: 'heading', id: 'h-ip', text: 'Who owns what' },
    {
      kind: 'definitionList',
      id: 'dl-ip',
      items: [
        {
          term: 'Yours',
          description:
            'Everything you put into Habiti — your habits, notes, photos and progress — remains yours. You give us only the permission we need to store it and show it to you, and to show the parts you have chosen to share with the people you shared them with.'
        },
        {
          term: 'Ours',
          description:
            'Habiti itself: the software, the habit and challenge libraries, the name and the design. You may use the service; you do not get any rights in it.'
        }
      ]
    },

    { kind: 'heading', id: 'h-availability', text: 'Availability' },
    {
      kind: 'paragraph',
      id: 'p-availability',
      text: 'We do not promise Habiti will always be available. We may change, suspend or withdraw features. Where a change materially affects you we will give you reasonable notice and, if it changes these terms, ask you to accept the new version.'
    },

    { kind: 'heading', id: 'h-warranty', text: 'What we promise, and what we do not' },
    {
      kind: 'paragraph',
      id: 'p-warranty',
      text: 'We will provide Habiti with reasonable care and skill. Beyond that, and beyond the rights the law gives you as a consumer, the service is provided as it is. We do not warrant that it will be uninterrupted, error-free, or that it will produce any particular result for you.'
    },

    { kind: 'heading', id: 'h-liability', text: 'Limits on our liability' },
    {
      kind: 'paragraph',
      id: 'p-liability-never',
      text: 'Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit. Your rights as a consumer are not affected.'
    },
    {
      kind: 'paragraph',
      id: 'p-liability-cap',
      text: 'Subject to that, we are not liable for loss of profit, loss of opportunity, or any loss that was not reasonably foreseeable; and we are not liable for what another user does with something you chose to share with them.'
    },
    {
      kind: 'review',
      id: 'review-cap',
      question: 'What is the liability cap, and does it sit sensibly under the insurance limit?',
      context:
        'Habiti is free today, so a "fees paid in the last 12 months" cap would be zero, which a court may not accept as reasonable. Set the cap and the cyber liability policy limit together — a cap far above cover is exposure, and cover far above the cap is waste.'
    },

    { kind: 'heading', id: 'h-indemnity', text: 'Your responsibility to us' },
    {
      kind: 'paragraph',
      id: 'p-indemnity',
      text: 'If you use Habiti in a way these terms forbid, and that causes a claim against us, you are responsible for the reasonable cost of dealing with it.'
    },

    { kind: 'heading', id: 'h-ending', text: 'Ending this agreement' },
    {
      kind: 'paragraph',
      id: 'p-ending',
      text: 'You can stop using Habiti at any time and ask us to delete your account. We may suspend or close an account that breaks these terms or puts other users at risk, and we will tell you why unless we are not allowed to. Some records of shared challenges survive so that the other people in them keep an accurate history; where we can, we remove your identity from those records.'
    },

    { kind: 'heading', id: 'h-changes', text: 'Changes to these terms' },
    {
      kind: 'paragraph',
      id: 'p-changes',
      text: 'Every version is numbered, dated and kept. You can read any earlier version and compare it with the one that replaced it. If a change materially affects you, we will ask you to accept the new version before you carry on.'
    },

    { kind: 'heading', id: 'h-law', text: 'Law and disputes' },
    {
      kind: 'paragraph',
      id: 'p-law',
      text: 'Please talk to us first — most things are quicker to fix that way. If we cannot resolve it, you keep every right you have as a consumer in the country where you live, including the right to bring proceedings there.'
    }
  ]
};
