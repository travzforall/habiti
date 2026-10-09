import { LegalDocument } from '../types';

/**
 * Privacy Policy, version 1. DRAFT.
 *
 * Every factual claim here was checked against the code, and where the code
 * cannot support a claim the document says so rather than making it. In
 * particular it does NOT say data is protected from other users, because
 * environment.ts ships a Baserow token in the client bundle and that is not
 * currently true. See the Trust page and the `review` blocks.
 */
export const PRIVACY_V1: LegalDocument = {
  id: 'privacy',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Privacy Policy',
  summary: 'What Habiti collects, why, who else sees it, and what you can ask us to do.',
  status: 'draft',
  material: true,
  changeSummary: '',
  contentHash: '40443c76c49ddb8934c0789d58a3d311915ea3f14e4f0dd419bd4812747e8457',
  blocks: [
    {
      kind: 'review',
      id: 'review-controller',
      question: 'Who is the data controller, legally?',
      context:
        'The policy needs a registered company name, address and company number. The app is "Habiti"; the database runs at db.jollycares.com, which suggests a JollyCares entity. If those are different legal entities, one of them is a processor and needs a signed Article 28 agreement.'
    },
    {
      kind: 'review',
      id: 'review-transfers',
      question: 'Where does the data physically live?',
      context:
        'Article 13(1)(f) requires disclosure of international transfers and the safeguards used. The Xano workspace region is not stated anywhere in the repo, and db.jollycares.com is self-hosted with no infrastructure config checked in. This policy cannot publish with these blank.'
    },
    {
      kind: 'review',
      id: 'review-contact',
      question: 'What is the privacy contact address, and who monitors it?',
      context:
        'Every right below needs a working address. Nothing is automated, so a human has to action erasure and access requests by hand in Xano and Baserow.'
    },

    { kind: 'heading', id: 'h-summary', text: 'The short version' },
    {
      kind: 'paragraph',
      id: 'p-summary',
      text: 'Habiti is a habit tracker. To use it you give us an email address, a name and your date of birth. What you then track is up to you, and some of it can be sensitive — recovery, therapy, medication, prayer. We ask separately before storing anything in those categories, and separately again before showing it to another person. We do not sell anything, we run no advertising network, we have no analytics, and we set no cookies.'
    },

    { kind: 'heading', id: 'h-collect', text: 'What we collect' },
    {
      kind: 'definitionList',
      id: 'dl-collect',
      items: [
        {
          term: 'Account details',
          description:
            'Email address, first and last name, username, and date of birth. Date of birth is required because Habiti is 18+; we use it to establish that you are old enough and we never display your age anywhere in the app.'
        },
        {
          term: 'Optional profile',
          description: 'A short bio, a location you type yourself, and a profile picture.'
        },
        {
          term: 'What you track',
          description:
            'The habits you choose, the days you completed them, and for each entry an optional note, an optional mood, and an optional photo.'
        },
        {
          term: 'Things you do in the app',
          description:
            'Tasks, projects, skills, challenges you start, friendships you form, and pledges you record.'
        },
        {
          term: 'Files you attach',
          description:
            'Documents, photos and video you attach to a task or project, along with their name, size and type. See "Files you attach" below for where they are stored and what we can and cannot do about deleting them.'
        }
      ]
    },
    {
      kind: 'paragraph',
      id: 'p-no-collect',
      text: 'We do not collect your location from your device, we do not fingerprint your browser, and we do not track you across other websites. Our hosting providers see your IP address in their server logs as an unavoidable part of serving you the page; we do not store it in our own database.'
    },

    { kind: 'heading', id: 'h-sensitive', text: 'Sensitive habits' },
    {
      kind: 'paragraph',
      id: 'p-sensitive-what',
      text: 'Some habits in our library reveal things the law treats as special: health and medication, mental health and therapy, recovery from alcohol or smoking, and religious practice such as prayer or scripture reading. Tracking any of these means we store health, mental-health, recovery or religious-belief information about you.'
    },
    {
      kind: 'callout',
      id: 'c-sensitive-consent',
      tone: 'info',
      text: 'We ask for your explicit consent before storing any of these, at the moment you first add such a habit — not buried in these terms. You can decline; the habit simply is not created, and nothing else in Habiti stops working. You can withdraw consent later in Settings, and we will offer to delete the affected habits.'
    },
    {
      kind: 'paragraph',
      id: 'p-sensitive-share',
      text: 'If you take part in a shared challenge, the other participants can see which days you checked in. For a recovery challenge that means another person can see which days you did and did not stay clean. We ask you separately before that happens, and we name who will see it. If you leave the challenge they stop seeing new check-ins, but they keep what they have already seen — we cannot take that back.'
    },

    { kind: 'heading', id: 'h-attachments', text: 'Files you attach' },
    {
      kind: 'paragraph',
      id: 'p-attachments-what',
      text: 'You can attach documents, photos and video to your tasks and projects. We store the file itself with our database provider, and we keep a record of its name, size, type and which task it belongs to. Whatever is inside the file — a photo of a letter, a scan, a receipt — is held by us as well, so please only attach what you are comfortable storing here.'
    },
    {
      kind: 'callout',
      id: 'c-attachments-public',
      tone: 'warning',
      text: 'Each attached file is stored at a long, random web address. It is not listed anywhere and will not appear in search results, but that address is not password-protected: anyone who has the link can open the file without signing in. We tell you this in the app before your first upload, and we are working on serving files only to the person they belong to.'
    },
    {
      kind: 'paragraph',
      id: 'p-attachments-delete',
      text: 'Removing an attachment takes it off your task and deletes our record of it. At present we cannot delete the stored copy of the file itself, so its web address keeps working. We would rather say that plainly than describe it as deleted. Ask us to remove a file and we will do it by hand until this is automatic.'
    },
    {
      kind: 'paragraph',
      id: 'p-attachments-exif',
      text: 'Photos are resized in your browser before they are sent, which has the side effect of removing the information cameras store inside them — including where the photo was taken. Video is sent as it is and keeps whatever your camera recorded.'
    },
    {
      kind: 'review',
      id: 'review-attachments',
      question: 'Is the public-URL disclosure sufficient, or should attachments be private before launch?',
      context:
        'Files are uploaded straight to Baserow, which serves them from an unauthenticated but unguessable URL, and a database token cannot delete them afterwards. Attachments on a task can plainly contain special-category data (a photo of a prescription, a therapy letter), which raises the stakes on both points. Making them private needs uploads and reads to move behind an API that checks the session — the same change the security section is waiting on.'
    },

    { kind: 'heading', id: 'h-inspiration', text: 'Inspiration boards' },
    {
      kind: 'paragraph',
      id: 'p-inspiration-what',
      text: 'You can keep videos, pictures, links and notes on a board. We store the web address you saved and whatever you typed alongside it. We do not download or copy the video or picture itself — a card on your board points at the original, wherever it lives.'
    },
    {
      kind: 'paragraph',
      id: 'p-inspiration-thumbnails',
      text: 'Because of that, showing a YouTube video as a card means your browser asks YouTube for the thumbnail image. That request tells Google your IP address, as any request to any website does. We do not send them your name, your email or which page you were on, videos do not play inside Habiti, and we embed nothing from them — but if you would rather Google saw nothing at all, do not save YouTube links.'
    },

    { kind: 'heading', id: 'h-why', text: 'Why we are allowed to hold it' },
    {
      kind: 'definitionList',
      id: 'dl-basis',
      items: [
        {
          term: 'To give you the service',
          description:
            'Your account, your habits and your progress. Without these there is no app. (Performance of a contract.)'
        },
        {
          term: 'Sensitive habits',
          description:
            'Only your explicit consent, asked for separately and recorded. (Article 9(2)(a).)'
        },
        {
          term: 'Keeping the service working and honest',
          description:
            'Preventing abuse, fixing faults, and keeping the records that make shared challenges verifiable to the people in them. (Legitimate interests.)'
        }
      ]
    },

    { kind: 'heading', id: 'h-sharing', text: 'Who else sees it' },
    {
      kind: 'paragraph',
      id: 'p-sharing-users',
      text: 'Other Habiti users see only what you choose to share with them: your name and avatar when you send or accept a friend invite, and your check-in dates within a challenge you both joined. They do not see your notes, your moods, your photos, or habits outside that challenge.'
    },
    {
      kind: 'paragraph',
      id: 'p-sharing-processors',
      text: 'We use a small number of suppliers to run the service. They process data on our instructions and for no purpose of their own. The current list is on our Subprocessors page and we keep it up to date.'
    },
    {
      kind: 'paragraph',
      id: 'p-sharing-no-sale',
      text: 'We do not sell personal data, we do not share it for advertising, and we run no third-party ad network. The only promotional slot in the app promotes Habiti itself.'
    },

    { kind: 'heading', id: 'h-invited', text: 'If someone invited you and you are not a user' },
    {
      kind: 'paragraph',
      id: 'p-invited',
      text: 'Habiti lets a user invite a friend by email address. When they do, we store that email address, plus the inviter\'s name, so the two can be connected if the invited person signs up. If someone has invited you and you would rather we did not hold your address, write to us and we will delete it.'
    },

    { kind: 'heading', id: 'h-rights', text: 'Your rights' },
    {
      kind: 'paragraph',
      id: 'p-rights-intro',
      text: 'You can ask us to give you a copy of your data, correct it, delete it, restrict what we do with it, or object to it. You can withdraw a consent at any time without affecting what we did before you withdrew it. You can also complain to your data protection regulator.'
    },
    {
      kind: 'callout',
      id: 'c-rights-manual',
      tone: 'warning',
      text: 'We should be straight with you about how these work today: they are handled by a person, by email, not by a button in the app. We do not yet have self-service account deletion or a complete data download. Write to us and we will do it by hand.'
    },
    {
      kind: 'review',
      id: 'review-sla',
      question: 'What response time do we commit to for access and erasure requests?',
      context:
        'The GDPR default is one month. Since both are manual operations across Xano and Baserow, someone has to own them. Do not publish a number nobody is accountable for.'
    },

    { kind: 'heading', id: 'h-keep', text: 'How long we keep it' },
    {
      kind: 'paragraph',
      id: 'p-keep',
      text: 'We keep your account and its data for as long as you have an account. Some records are deliberately permanent while your account exists: the ledger of levels you have earned, and the event history of shared challenges. These exist so your progress cannot be quietly rewritten and so the other person in a challenge can rely on what it says. If you ask us to delete your account we remove your identity from those records rather than deleting the records themselves, so that the other participants\' history stays intact.'
    },
    {
      kind: 'review',
      id: 'review-retention',
      question: 'Retention periods for pending friend invites and for deleted accounts.',
      context:
        'The intent is to delete unaccepted invites after 90 days, but there is no scheduled job to do it. Do not describe it as an operating control until something actually runs it.'
    },

    { kind: 'heading', id: 'h-storage', text: 'Cookies and storage' },
    {
      kind: 'paragraph',
      id: 'p-storage',
      text: 'Habiti sets no cookies at all, and there is no cookie banner because there is nothing to consent to. We do use your browser\'s local storage to keep you signed in and to hold your habits so the app works quickly. Clearing your browser storage signs you out. Our Cookies and Storage page has the detail.'
    },

    { kind: 'heading', id: 'h-security', text: 'Security' },
    {
      kind: 'paragraph',
      id: 'p-security',
      text: 'We would rather describe our security honestly than make a claim we cannot back. Our Trust page sets out how Habiti is built, what we are currently working on, and known weaknesses we are fixing. If you find a security problem, please tell us.'
    },
    {
      kind: 'review',
      id: 'review-security-claims',
      question: 'Review this section against the Trust page before publication.',
      context:
        'The app currently ships a database credential in its JavaScript bundle, which means access between user accounts is not enforced by the server. Any sentence in this policy implying otherwise would be false. This is being fixed by moving data access behind an API.'
    },

    { kind: 'heading', id: 'h-children', text: 'Children' },
    {
      kind: 'paragraph',
      id: 'p-children',
      text: 'Habiti is for adults. You must be 18 or over to create an account, and we ask for your date of birth at sign-up to check. If you believe someone under 18 has an account, tell us and we will remove it.'
    },

    { kind: 'heading', id: 'h-changes', text: 'Changes to this policy' },
    {
      kind: 'paragraph',
      id: 'p-changes',
      text: 'Every version of this policy is kept, numbered and dated, and you can read any previous version and compare it against the one that replaced it. If we change something that materially affects you we will ask you to read and accept the new version before you carry on using Habiti.'
    }
  ]
};
