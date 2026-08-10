import { TourStep } from '../services/tour.service';

/**
 * One-off tips, shown the first time a user opens a page.
 *
 * This is the other half of the onboarding split. The main guide
 * (app-tour.steps.ts) stays at ten stops covering the daily loop, and the
 * deeper corners of the app introduce themselves instead — which is what keeps
 * the initial walkthrough short enough that people finish it.
 *
 * Keyed by route. `id` doubles as the key recorded in `page_tips_seen`, so it
 * must match the route exactly and must never be renumbered.
 *
 * These are centred cards with no spotlight: a page tip is orienting the user
 * to a whole page, not to one control on it.
 */
export const PAGE_TIPS: Record<string, TourStep> = {
  '/skills': {
    id: '/skills',
    placement: 'center',
    title: 'Skills',
    body: 'The long game. Pick a skill and the habits you already keep start counting toward it — practice days, streaks and hours, all derived from what you already track.'
  },
  '/challenges': {
    id: '/challenges',
    placement: 'center',
    title: 'Challenges',
    body: 'A habit with a deadline and a difficulty. Finish one and it is worth permanent levels — those never go back down.'
  },
  '/friends': {
    id: '/friends',
    placement: 'center',
    title: 'Friends',
    body: 'Invite someone by email and you will see each other’s streaks. Accountability works better than willpower for most people.'
  },
  '/game': {
    id: '/game',
    placement: 'center',
    title: 'Gamification',
    body: 'Points, levels and achievements, all earned from habits you have actually completed. Nothing here can be bought.'
  },
  '/tasks': {
    id: '/tasks',
    placement: 'center',
    title: 'Tasks',
    body: 'For one-off things that are not habits. A task is done once and disappears; a habit comes back tomorrow.'
  },
  '/projects': {
    id: '/projects',
    placement: 'center',
    title: 'Projects',
    body: 'Bigger goals made of tasks and milestones. Use these when something is too large to be one line on a checklist.'
  },
  '/calendar': {
    id: '/calendar',
    placement: 'center',
    title: 'Calendar',
    body: 'Your history, month by month. Click any day to see exactly what you did and did not do.'
  }
};

/** The tip for a URL, if it has one and has not been seen. */
export function pageTipFor(url: string): TourStep | null {
  const path = url.split('?')[0].split('#')[0];
  return PAGE_TIPS[path] ?? null;
}
