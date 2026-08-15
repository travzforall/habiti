import { SensitiveCategory } from '../models/consent.models';
import { LibraryHabit } from './habit-library/types';

/**
 * Which habits reveal special-category data under GDPR Article 9.
 *
 * DERIVED FROM THE LIBRARY'S OWN tags AND subcategoryId, never a hand-written
 * list of ids. A list would be correct on the day it was written and wrong the
 * first time someone adds `take-insulin` next to `take-medication` — and it
 * would be wrong silently, which is the failure mode that matters here.
 *
 * WHERE THE LINE IS. "Data concerning health" is broad enough that a purist
 * reading catches "drink water". Prompting for consent on drinking water is not
 * caution, it is consent fatigue, and a user who has clicked through six
 * meaningless prompts will click through the one about their recovery too. So
 * the test applied here is narrower and, I think, the one that matters: does
 * tracking this habit REVEAL a health condition, a treatment, a dependency, or
 * a belief?
 *
 *   take-medication   yes — reveals a prescription
 *   doctor-checkup    yes — reveals medical care
 *   therapy-session   yes — reveals mental-health treatment
 *   no-alcohol        yes — reveals a relationship with alcohol
 *   pray              yes — reveals religious belief
 *   sleep-7-hours     no  — health-adjacent, reveals no condition
 *   water-8           no
 *
 * That line is a judgement, and it is the judgement a reviewing lawyer should
 * be asked to confirm — it is flagged in the privacy policy's review blocks.
 */

/** Tags that, on their own, mark a habit as sensitive. */
const SENSITIVE_TAGS: Record<string, SensitiveCategory> = {
  // Applied to take-medication and doctor-checkup: a prescription and a
  // clinical appointment both reveal health status.
  medical: 'health',
  // Applied across health.ts and mind.ts to alcohol, smoking, triggers and
  // support groups.
  sobriety: 'sobriety'
};

/**
 * Subcategories whose every habit is sensitive.
 *
 * `emotional` is "Emotional health — support, triggers and digital hygiene";
 * `faith` is "Faith & reflection — prayer, scripture and stillness". Belonging
 * to either is enough on its own, which is what stops a new habit dropped into
 * one of them from being missed.
 */
const SENSITIVE_SUBCATEGORIES: Record<string, SensitiveCategory> = {
  emotional: 'mental_health',
  faith: 'religion'
};

/**
 * The category a habit falls into, or undefined.
 *
 * A habit can match more than one rule — `note-the-trigger` is tagged
 * `sobriety` and sits in `emotional`. The TAG wins, because it is the more
 * specific statement about what the habit reveals, and because asking for
 * "recovery" consent is more honest than asking for "mental health" consent
 * when the habit is plainly about staying clean.
 */
export function sensitiveCategoryOf(habit: LibraryHabit): SensitiveCategory | undefined {
  for (const tag of habit.tags ?? []) {
    const byTag = SENSITIVE_TAGS[tag];
    if (byTag) return byTag;
  }
  return SENSITIVE_SUBCATEGORIES[habit.subcategoryId];
}

export function isSensitive(habit: LibraryHabit): boolean {
  return sensitiveCategoryOf(habit) !== undefined;
}

/** The distinct categories a set of habits would need consent for. */
export function sensitiveCategoriesIn(habits: readonly LibraryHabit[]): SensitiveCategory[] {
  const found = new Set<SensitiveCategory>();
  for (const habit of habits) {
    const category = sensitiveCategoryOf(habit);
    if (category) found.add(category);
  }
  return [...found];
}

/**
 * Challenge categories that reveal Article 9 data by themselves.
 *
 * A shared challenge shows the other participants which days you checked in —
 * `ChallengeParticipant.checkIns` is commented "visible to the other side,
 * which is the point". For a thirty-day "Clean Streak" that means another
 * person can see which days you did and did not stay clean, which is recovery
 * data disclosed to a third party.
 *
 * Keyed off the challenge CATEGORY rather than the bound habits because the
 * category is the honest signal: the challenge is named and described as being
 * about sobriety, so joining it discloses that regardless of which habits are
 * attached to it.
 */
export const SENSITIVE_CHALLENGE_CATEGORIES: Record<string, SensitiveCategory> = {
  sobriety: 'sobriety'
};

/** The Article 9 category a challenge would disclose, if any. */
export function sensitiveCategoryOfChallenge(category: string): SensitiveCategory | undefined {
  return SENSITIVE_CHALLENGE_CATEGORIES[category];
}

/** How each category is described to the user, in the consent prompt. */
export const SENSITIVE_CATEGORY_COPY: Record<
  SensitiveCategory,
  { label: string; icon: string; stores: string }
> = {
  health: {
    label: 'Health and medication',
    icon: '💊',
    stores:
      'that you track medication or medical appointments, which days you did, and anything you write in the notes'
  },
  mental_health: {
    label: 'Mental health',
    icon: '💗',
    stores:
      'that you track therapy, support or difficult days, which days you did, and anything you write in the notes'
  },
  sobriety: {
    label: 'Recovery',
    icon: '🌊',
    stores:
      'that you track staying away from alcohol or smoking, which days you did and did not, and anything you write in the notes'
  },
  religion: {
    label: 'Faith',
    icon: '🕯️',
    stores: 'that you track prayer, scripture or worship, and which days you did'
  }
};
