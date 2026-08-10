/**
 * The relay to use, decided at runtime.
 *
 * angular.json has no fileReplacements, so this one file serves both the dev
 * server and a production build. A hardcoded ws://localhost:8080 would follow a
 * deployed bundle to a real host and try to open a plaintext socket from an
 * https page — a mixed-content error in every user's console, which is exactly
 * what the empty default exists to prevent. So the local relay is used only
 * when the app is actually running locally.
 *
 * To use a deployed relay, return its wss:// URL for the non-local case.
 */
function relayUrl(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  // Follow the page's own hostname rather than hardcoding "localhost".
  // localhost:4200 and 127.0.0.1:4200 are DIFFERENT origins with separate
  // localStorage — which is exactly how you run two accounts side by side —
  // and the relay checks Origin, so a hardcoded host gets one of them rejected.
  return isLocal ? `ws://${host}:8080` : '';
}

export const environment = {
  production: false,
  baserow: {
    apiUrl: 'https://db.jollycares.com/api/database/rows/table',
    token: 'N7OzGYtyscWg1D9mmokf3k149JZB2diH',
    tables: {
      /**
       * The SCHEDULER app's tables — the Claude automation system.
       *
       * They live in a different Baserow database, have no user column, and
       * carry agent/phase semantics that mean nothing to a Habiti user. Do not
       * write a user's personal work here; use userTasks / userProjects below.
       */
      taskUpdates: 508,
      tasks: 509,
      agents: 506,
      projects: 507,

      /**
       * A user's own tasks and projects.
       *
       * 0 until created — TasksService and ProjectsService stay local-only and
       * warn rather than writing to the wrong database. Create them with:
       *   node scripts/create-baserow-table.mjs 27-user-projects.json --apply
       *   node scripts/create-baserow-table.mjs 28-user-tasks.json --apply
       * then paste the returned ids here.
       */
      userProjects: 0,
      userTasks: 0,
      comments: 510,
      milestones: 511,
      sessions: 512,
      // Friends & Campaigns. Set to 0 until the tables are created in Baserow —
      // FriendsService/CampaignsService no-op with a warning while an id is 0.
      friendships: 620,
      campaigns: 621,
      campaignParticipants: 622,
      campaignRuleVersions: 623,
      campaignReports: 624,
      campaignPledges: 625,
      campaignSettlements: 626,
      campaignEvents: 627,
      challengeTemplates: 628,
      // Rotating daily inspiration. Falls back to a bundled seed set while 0.
      dailyContent: 618,
      // Append-only level ledger. While 0, LevelService keeps records in
      // localStorage and flushes them once a real table id appears.
      levelRecords: 619,
      // Onboarding wizard + app guide state, one row per user. While 0,
      // OnboardingService keeps state in localStorage and flushes it once a
      // real table id appears. Note it must ALSO know the difference between
      // "not configured" and "no row" — an empty result from an unconfigured
      // table would otherwise read as "this user has never onboarded".
      userOnboarding: 629,
      /**
       * A user's skill tracks.
       *
       * 0 until created — SkillsService stays local-only (UserStorage) and
       * warns once, rather than reading an empty result and concluding the
       * user has no skills. Create it with:
       *   node scripts/create-baserow-table.mjs 29-user-skills.json --apply
       * then paste the returned id here.
       */
      userSkills: 632,
    },
  },
  /**
   * The realtime relay.
   *
   * EMPTY IS THE CORRECT DEFAULT. While this is '', RealtimeService never
   * constructs a WebSocket and the app syncs by adaptive polling with a clean
   * console. Setting it is the one-line switch that turns push on — do NOT
   * point it at wss://ws.jollycares.com, which is dead and belongs to the
   * unrelated monitoring product.
   */
  realtime: {
    url: relayUrl(),
  },
  // Habiti records campaign pledges but never holds or transfers funds. On a
  // failed staked campaign the user is sent here to donate directly.
  charity: {
    iluvProjectAfricaUrl: 'iluvfoundation.org',
    iluvFoundationName: 'iLuv Foundation',
    projectName: 'Project Africa',
  },
  xano: {
    apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:pWFaI9Bq',
    endpoints: {
      auth: {
        login: '/auth/login',
        register: '/auth/signup',
        logout: '/auth/logout',
        refresh: '/auth/refresh',
        me: '/auth/me',
        forgotPassword: '/auth/forgot-password',
        resetPassword: '/auth/reset-password',
      },
      users: {
        profile: '/users/profile',
        update: '/users/update',
      },
    },
  },
  // Security & Monitoring Services
  wsUrl: 'wss://ws.jollycares.com',
  googleMapsApiKey: '', // Add your Google Maps API key here
  twilioAccountSid: '', // Add your Twilio Account SID here
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};
