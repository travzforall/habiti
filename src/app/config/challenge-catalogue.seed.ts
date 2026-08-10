import { ChallengeTemplate } from '../models/challenge.models';

/**
 * The challenge catalogue.
 *
 * Bundled in code rather than stored in Baserow, deliberately. These level
 * values drive PERMANENT awards, so they should be code-reviewed and pinned to
 * a release — not editable by anyone holding the client-side API token.
 *
 * ⚠️ SETTLE THESE NUMBERS BEFORE THE FIRST CHALLENGE RECORD IS WRITTEN.
 * Levels are permanent, so lowering a value afterwards needs a compensating
 * `manual` record on every affected user. The whole scale lives in the
 * easy/medium/hard columns below — multiply the column, don't rewrite logic.
 *
 * Current scale: roughly a week of hard work ≈ 10 levels.
 */
export const CHALLENGE_CATALOGUE: ChallengeTemplate[] = [
  template({
    id: 'first-seven',
    title: 'First Seven',
    description: 'Seven days, one thing a day. The one that proves you can start.',
    icon: '🌅',
    category: 'discipline',
    durationDays: 7,
    levels: [5, 7, 10],
    sortIndex: 1,
    habits: ['no-zero-day']
  }),
  template({
    id: 'cold-start-7',
    title: '7-Day Cold Start',
    description: 'A full week without breaking the chain. No warm-up, no easing in.',
    icon: '🥶',
    category: 'discipline',
    durationDays: 7,
    levels: [6, 9, 12],
    sortIndex: 2,
    habits: ['no-zero-day', 'review-day']
  }),
  template({
    id: 'no-zero-days-14',
    title: 'No Zero Days',
    description: 'Fourteen days where you do something — anything — toward the goal.',
    icon: '📈',
    category: 'discipline',
    durationDays: 14,
    levels: [10, 15, 20],
    sortIndex: 3,
    habits: ['no-zero-day', 'review-day', 'top-three']
  }),
  template({
    id: 'quiet-mind-21',
    title: 'Quiet Mind',
    description: 'Twenty-one days of stillness. Long enough to notice the difference.',
    icon: '🧘',
    category: 'mind',
    durationDays: 21,
    levels: [14, 20, 28],
    sortIndex: 4,
    habits: ['meditate-10', 'box-breathing', 'no-screens-before-bed', 'journal']
  }),
  template({
    id: 'deep-work-4w',
    title: 'Deep Work',
    description: 'Four weeks of focused sessions. Checked in once a week.',
    icon: '🛠️',
    category: 'craft',
    durationDays: 28,
    cadence: 'weekly',
    levels: [16, 24, 32],
    sortIndex: 5,
    habits: ['deep-work-block', 'no-social-during-work', 'phone-in-other-room', 'top-three']
  }),
  template({
    id: 'iron-thirty',
    title: 'Iron Thirty',
    description: 'Thirty days of training. The one people talk about afterwards.',
    icon: '🏋️',
    category: 'fitness',
    durationDays: 30,
    levels: [20, 30, 40],
    sortIndex: 6,
    habits: ['full-body-session', 'stretch', 'protein-every-meal', 'sleep-7-hours']
  }),
  template({
    id: 'clean-streak-30',
    title: 'Clean Streak',
    description: 'Thirty days clear. Check in every day, honestly, whatever happened.',
    icon: '🌊',
    category: 'sobriety',
    durationDays: 30,
    levels: [20, 30, 40],
    sortIndex: 7,
    habits: ['no-alcohol', 'support-group', 'note-the-trigger', 'message-someone']
  })
];

interface TemplateInput {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: ChallengeTemplate['category'];
  durationDays: number;
  cadence?: 'daily' | 'weekly';
  /** [easy, medium, hard] level values. */
  levels: [number, number, number];
  /** Library habit ids offered on start; the user picks which to create. */
  habits?: string[];
  sortIndex: number;
  minTier?: ChallengeTemplate['minTier'];
}

function template(input: TemplateInput): ChallengeTemplate {
  const [easy, medium, hard] = input.levels;
  const cadence = input.cadence ?? 'daily';
  const periods = cadence === 'weekly' ? Math.round(input.durationDays / 7) : input.durationDays;
  const unit = cadence === 'weekly' ? 'weeks' : 'days';

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    icon: input.icon,
    category: input.category,
    durationDays: input.durationDays,
    cadence,
    baseLevelValue: easy,
    minTier: input.minTier ?? 'free',
    allowsPartner: false,
    suggestedHabitIds: input.habits,
    sortIndex: input.sortIndex,
    active: true,
    tiers: {
      easy: tier(easy, 0.7, 3, periods, unit),
      medium: tier(medium, 0.85, 1, periods, unit),
      hard: tier(hard, 1, 0, periods, unit)
    }
  };
}

function tier(
  levelValue: number,
  requiredPassRate: number,
  graceMisses: number,
  periods: number,
  unit: string
) {
  const needed = Math.ceil(periods * requiredPassRate);
  const blurb =
    graceMisses === 0
      ? `All ${periods} ${unit}. No misses.`
      : `${needed} of ${periods} ${unit}. Miss ${graceMisses} and you're still in.`;

  return { levelValue, targetPerPeriod: 1, requiredPassRate, graceMisses, blurb };
}
