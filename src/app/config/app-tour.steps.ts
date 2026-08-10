import { TourStep } from '../services/tour.service';

/**
 * The interactive app guide.
 *
 * Ten stops covering the daily loop — see something, tick it off, watch it add
 * up — and nothing else. Challenges, Friends, Tasks and Projects are covered by
 * the per-page tips in page-tips.ts instead, which is what keeps this short
 * enough that people finish it.
 *
 * Copy rules, so later additions match:
 *  - Second person, one idea per tip, under 200 characters.
 *  - Say what the thing is FOR, not what it is called. The label is already on
 *    screen; the tip earns its place by adding what the label cannot say.
 *  - No stacked exclamation marks.
 *
 * Every `target` selector is a `data-tour` attribute added to a template. They
 * are invisible contracts — a template edit can silently break one. The
 * `onMissing` fallback keeps that from hanging the tour, and app-tour.steps.spec
 * checks the data, but neither catches a renamed anchor. Grep before renaming.
 */
export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    placement: 'center',
    title: 'Welcome to Habiti',
    body: 'Ten quick stops, about ninety seconds. Press Esc whenever you like — the guide remembers where you got to.'
  },
  {
    id: 'today-habits',
    route: '/dashboard',
    target: [{ selector: '[data-tour="today-habits"]' }],
    placement: 'bottom',
    title: 'Your day, in one card',
    body: 'Everything due today lives here. If you only ever look at one part of Habiti, make it this one.'
  },
  {
    id: 'complete-habit',
    route: '/dashboard',
    target: [{ selector: '[data-tour="habit-card"]' }],
    placement: 'right',
    // Someone who skipped setup has no habits, so there is genuinely nothing to
    // point at. Skipping beats a tip about an element that is not on screen.
    onMissing: 'skip',
    interactive: true,
    title: 'Tick it off',
    body: 'Tap a habit to mark it done, and tap again if it was a mis-tap. That is the whole daily loop. Go on, try it.'
  },
  {
    id: 'streak-points',
    target: [
      { selector: '[data-tour="nav-stats"]', media: '(min-width: 1280px)' },
      { selector: '[data-tour="nav-profile"]' }
    ],
    placement: 'bottom',
    title: 'Level, streak, points',
    body: 'LVL is permanent and only ever goes up. The flame is your current run. Points track how consistent you have been lately.'
  },
  {
    id: 'add-habit',
    route: '/habits',
    target: [{ selector: '[data-tour="add-habit"]' }],
    placement: 'bottom',
    title: 'Adding your own',
    body: 'A name and a difficulty is all it takes. Everything else has a sensible default you can change later.'
  },
  {
    id: 'templates',
    route: '/templates',
    target: [{ selector: '[data-tour="template-packs"]' }],
    placement: 'bottom',
    title: 'Do not start from scratch',
    body: 'Ready-made routines built from the same habit library. Pick a pack, untick anything that is not you, add the rest.'
  },
  {
    id: 'calendar',
    route: '/calendar',
    target: [{ selector: '[data-tour="calendar-grid"]' }],
    placement: 'top',
    title: 'The honest view',
    body: 'Every day you did or did not, laid out. One gap means nothing. A pattern of gaps is the useful bit.'
  },
  {
    id: 'analytics',
    route: '/analytics',
    target: [{ selector: '[data-tour="key-metrics"]' }],
    placement: 'bottom',
    title: 'How it is actually going',
    body: 'Give it a week or two of history and this page starts telling you which habits genuinely stick. Worth a look weekly.'
  },
  {
    id: 'nav-desktop',
    media: '(min-width: 1024px)',
    target: [{ selector: '[data-tour="side-nav"]' }],
    placement: 'right',
    title: 'Everything else',
    body: 'The whole app is in this sidebar. Dashboard and Habits are the two you will wear out; the rest is there when you want it.'
  },
  {
    id: 'nav-mobile',
    media: '(max-width: 1023px)',
    target: [{ selector: '[data-tour="bottom-nav"]' }],
    placement: 'top',
    title: 'Everything else',
    body: 'Five taps to everywhere. The plus in the middle is the quickest way to add anything, and More has Challenges and Friends.'
  },
  {
    id: 'settings-replay',
    route: '/settings',
    target: [{ selector: '[data-tour="replay-guide"]' }],
    placement: 'bottom',
    title: 'That is the tour',
    body: 'It lives here if you want it again. Theme, difficulty and your data are on this page too. Now go tick something off.'
  }
];

/** The longest a user can actually see — the two nav steps are exclusive. */
export const APP_TOUR_VISIBLE_LENGTH = APP_TOUR_STEPS.length - 1;
