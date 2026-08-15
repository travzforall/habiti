import { LegalDocument } from '../types';

/**
 * Cookies and Storage, version 1. DRAFT.
 *
 * Mostly good news, and worth saying out loud: a repo-wide search finds no
 * `document.cookie` anywhere, no analytics, no advertising and no third-party
 * scripts in index.html. So there is nothing to ask consent for and no banner
 * is needed. That is unusual enough to be worth stating plainly rather than
 * leaving a user to assume the worst.
 *
 * NOTE FOR LATER: the planned move to an API replaces the localStorage token
 * with an HttpOnly session cookie. That cookie is strictly necessary for a
 * service the user asked for, so it still needs no consent — but this document
 * must be updated when it lands.
 */
export const COOKIES_V1: LegalDocument = {
  id: 'cookies',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Cookies and Storage',
  summary: 'Habiti sets no cookies. Here is what it does use.',
  status: 'draft',
  material: false,
  changeSummary: '',
  contentHash: '233035fc64397fb40ea929f77fc2697a2fe661e720133b76a354b4cdeca13254',
  blocks: [
    { kind: 'heading', id: 'h-no-cookies', text: 'We set no cookies' },
    {
      kind: 'paragraph',
      id: 'p-no-cookies',
      text: 'Habiti does not set any cookies, so there is no cookie banner and nothing for you to accept or reject. We have no analytics, no advertising network, no tag manager and no third-party scripts on the page.'
    },

    { kind: 'heading', id: 'h-storage', text: 'What we do use' },
    {
      kind: 'paragraph',
      id: 'p-storage-intro',
      text: 'We use your browser\'s local storage, which stays on your device and is not sent automatically with every request the way a cookie is. We use it for two things.'
    },
    {
      kind: 'definitionList',
      id: 'dl-storage',
      items: [
        {
          term: 'Keeping you signed in',
          description:
            'Your access token and your basic profile. If you did not tick "remember me" this is cleared when you close the tab.'
        },
        {
          term: 'Making the app work',
          description:
            'A copy of your habits, tasks, projects and preferences, so the app can show them immediately and keep working if the network drops.'
        }
      ]
    },
    {
      kind: 'paragraph',
      id: 'p-storage-clear',
      text: 'Both are strictly necessary to provide the service you asked for, which is why no consent is required for them. Clearing your browser storage removes them and signs you out.'
    },

    { kind: 'heading', id: 'h-multi-user', text: 'Shared devices' },
    {
      kind: 'paragraph',
      id: 'p-multi-user',
      text: 'Locally stored data is separated per account, so signing in as someone else on the same browser does not show them your habits. Even so, on a shared computer, sign out when you are done.'
    }
  ]
};
