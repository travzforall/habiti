import { LegalDocument } from '../types';

/**
 * Refund Policy, version 1. DRAFT.
 *
 * SHORT ON PURPOSE. Habiti takes no payments: there is no payment provider, no
 * checkout, no price anywhere in the code, and `subscription_tier` is a field
 * someone sets by hand. A long refund policy for a product that cannot charge
 * you would be speculative fiction.
 *
 * The clause that earns its place is the one about pledges, because that is
 * the only place money is mentioned in the app and the honest answer is
 * counter-intuitive: Habiti never receives it, so Habiti cannot refund it.
 *
 * The review block records what has to be BUILT — not merely written — when
 * billing arrives. Those are UI requirements and cannot be retro-fitted into a
 * policy document.
 */
export const REFUNDS_V1: LegalDocument = {
  id: 'refunds',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Refunds',
  summary: 'Habiti does not currently charge for anything.',
  status: 'draft',
  material: true,
  changeSummary: '',
  contentHash: '538cde0ba30b4b6d6c7ea6e75a21530209575f4764118ee27a530f965338ff4b',
  blocks: [
    { kind: 'heading', id: 'h-free', text: 'Habiti is free' },
    {
      kind: 'paragraph',
      id: 'p-free',
      text: 'We do not currently charge for Habiti. There is no subscription to buy, no checkout, and no way to pay us. If that changes we will update this page, and because it would materially affect you we will ask you to read and accept the new version first.'
    },

    { kind: 'heading', id: 'h-pledges', text: 'Pledges are not payments to us' },
    {
      kind: 'callout',
      id: 'c-pledges',
      tone: 'warning',
      text: 'Habiti records this agreement. It never holds or transfers money. If you miss a challenge you staked something on, you give directly to the charity yourself and mark it in the app.'
    },
    {
      kind: 'paragraph',
      id: 'p-pledges',
      text: 'Because the money never passes through Habiti, there is nothing for us to refund. If you gave to a charity and want it back, that is between you and them. If you and the other person disagree about whether a stake was owed, that is between the two of you — Habiti records what you both said and takes no side.'
    },

    { kind: 'heading', id: 'h-ads', text: 'Advertising' },
    {
      kind: 'paragraph',
      id: 'p-ads',
      text: 'The one promotional panel in Habiti promotes Habiti. We run no third-party advertising network and nobody pays us to show you anything.'
    },

    {
      kind: 'review',
      id: 'review-checkout',
      question: 'Before billing ships, these are UI requirements, not wording.',
      context:
        '1) Show the total price including VAT, the billing period and the renewal terms before the button. 2) Label the button with the payment obligation — "Subscribe — obligation to pay", never "Continue"; a button labelled "Continue" does not form a binding order under the EU Consumer Rights Directive. 3) Give a 14-day right of withdrawal on digital content. 4) If access starts immediately, take TWO separate unticked checkboxes: an express request to begin during the withdrawal period, and an acknowledgement that the right is thereby lost. One combined checkbox does not satisfy this. 5) Provide a model withdrawal form. 6) Send an order confirmation on a durable medium. 7) Never price-differentiate on the basis of what someone tracks — a "recovery" tier priced differently from a "fitness" tier would be discrimination on special-category data.'
    }
  ]
};
