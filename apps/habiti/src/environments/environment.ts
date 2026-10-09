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
       * They live in Baserow database 127, NOT Habiti's 128. They have no user
       * column and carry agent/phase semantics that mean nothing to a Habiti
       * user. Do not write a user's personal work here; use userTasks /
       * userProjects below.
       *
       * Verified against the live database: 508 is `tasks` (it has task_id,
       * phase, assigned_agent_id and a link field named tasks_updates), and
       * 509 is `tasks_updates`. These two were previously swapped here.
       */
      tasks: 508,
      taskUpdates: 509,
      agents: 506,
      projects: 507,

      /**
       * A user's own tasks and projects, in Habiti's database 128.
       *
       * Created via:
       *   node scripts/create-baserow-table.mjs 27-user-projects.json --apply
       *   node scripts/create-baserow-table.mjs 28-user-tasks.json --apply
       */
      userProjects: 630,
      userTasks: 631,
      comments: 510,
      sessions: 512,
      /**
       * The SCHEDULER's `milestones` table (511) used to be listed here as
       * `milestones`, and nothing ever read it — which was lucky, because it
       * links to the scheduler's projects (507) and has no start date, owner,
       * colour or sort order. A user's milestone cannot live in it. It is gone
       * from this list so nobody wires it up by reaching for the obvious name.
       *
       * The real one is created by `npm run db:setup`; while it is 0,
       * ProjectsService keeps milestones in localStorage.
       */
      projectMilestones: 638,
      /**
       * A project's money: the item list (37) and the expense list (38).
       * Zero until `npm run db:setup` creates them; ProjectBudgetService keeps
       * both in localStorage meanwhile and says so, once.
       */
      projectItems: 639,
      projectExpenses: 640,
      /** Plan A, Plan B — the planner. Zero until db:setup creates it. */
      projectPlans: 641,
      /** Tools a job needs — owned, borrowed, hired or still to buy. */
      projectTools: 643,
      /** What one person changed about the built-in supplies list. */
      userSupplies: 644,
      /**
       * The user's standing kit, independent of any job.
       *
       * NOT the same thing as projectItems/projectTools above: those are
       * per-project rows that die with the project. This is the catalogue they
       * are created FROM. Zero until db:setup creates it; ToolkitService keeps
       * everything in localStorage meanwhile and flushes once an id appears.
       */
      toolkitItems: 642,
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
      /**
       * What each user has agreed to: documents accepted, Article 9 consents.
       *
       * 0 until created — ConsentService records everything locally and warns
       * once. Create it with:
       *   node scripts/create-baserow-table.mjs 30-legal-acceptances.json --apply
       * then paste the returned id here.
       *
       * Note that a row here is CORROBORATION, not evidence, while the Baserow
       * token ships in the bundle — see the notes in the schema file.
       */
      legalAcceptances: 645,
      /**
       * Files and links attached to tasks and projects.
       *
       * 0 until created — AttachmentsService keeps them in UserStorage and
       * warns once, so attaching still works on one browser rather than
       * failing. Create it with:
       *   node scripts/create-baserow-table.mjs 31-task-attachments.json --apply
       * then paste the returned id here.
       *
       * The UPLOAD does not depend on this id: files go to Baserow's storage
       * either way (see baserow.filesUrl). Without the table, the app just has
       * nowhere shared to record that the file belongs to this task.
       */
      taskAttachments: 633,
      /**
       * The steps inside a task — what its progress bar is made of.
       *
       * 0 until created; ChecklistService stays local-only meanwhile. Create with:
       *   node scripts/create-baserow-table.mjs 32-task-checklist-items.json --apply
       */
      taskChecklistItems: 634,
      /**
       * Inspiration boards — videos, pictures, links and notes a user keeps.
       *
       * 0 until created; InspirationService stays local-only meanwhile. Create with:
       *   node scripts/create-baserow-table.mjs 33-inspiration-items.json --apply
       */
      inspirationItems: 635,
      /**
       * Mind maps: the document, and one row per node.
       *
       * 0 until created; MindMapService stays local-only meanwhile. Create with:
       *   node scripts/create-baserow-table.mjs 34-mind-maps.json --apply
       *   node scripts/create-baserow-table.mjs 35-mind-map-nodes.json --apply
       */
      mindMaps: 636,
      mindMapNodes: 637,
    },
    /**
     * Baserow's file upload endpoint.
     *
     * Separate from `apiUrl` because it is not a rows endpoint — it sits at
     * /api/user-files/, not /api/database/rows/table/.
     *
     * ⚠ WHAT COMES BACK IS A PUBLIC URL. Long and unguessable, but served with
     * no authentication at all: anyone holding the link can read the file,
     * from anywhere, indefinitely. Verified against this instance on
     * 2026-08-15. The app says so before a user's first upload
     * (attachment-notice.component.ts) and the privacy policy says so too.
     * Do not describe attachments as private anywhere until that changes.
     */
    filesUrl: 'https://db.jollycares.com/api/user-files/upload-file/',
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
};
