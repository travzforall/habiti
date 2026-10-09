import { LibraryHabit, pick } from './habit-library';

/**
 * Curated starter packs, assembled FROM the habit library.
 *
 * Packs no longer carry their own copies of habits. They reference library ids,
 * so "Read for 30 minutes" has one description, one point value and one set of
 * guidance wherever it appears — a pack, a challenge, or the browse view.
 * `pick()` throws on an unknown id, so a typo fails the build rather than
 * quietly producing a pack that is one habit short.
 */

export interface HabitTemplatePack {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Tailwind gradient classes for the card header. */
  accent: string;
  habits: LibraryHabit[];
}

export const HABIT_TEMPLATE_PACKS: HabitTemplatePack[] = [
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    icon: '🌅',
    description: 'Start the day deliberately instead of reactively.',
    accent: 'from-amber-400 to-orange-500',
    habits: pick(
      'same-wake-time',
      'make-bed',
      'water-on-waking',
      'stretch',
      'top-three',
      'morning-light'
    )
  },
  {
    id: 'strength-basics',
    name: 'Strength Basics',
    icon: '🏋️',
    description: 'The four lifts everything else is built on.',
    accent: 'from-rose-400 to-red-600',
    habits: pick('back-squat', 'deadlift', 'bench-press', 'overhead-press', 'warm-up')
  },
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    icon: '🔁',
    description: 'A classic three-way split you can run for years.',
    accent: 'from-red-400 to-rose-600',
    habits: pick('push-day', 'pull-day', 'leg-day', 'stretch', 'rest-day')
  },
  {
    id: 'no-gym',
    name: 'No Gym Needed',
    icon: '🤸',
    description: 'Everything here works in a room with no kit.',
    accent: 'from-orange-400 to-amber-600',
    habits: pick('push-ups', 'bodyweight-workout', 'plank', 'walk-10k', 'stretch')
  },
  {
    id: 'runner',
    name: "Runner's Base",
    icon: '🏃',
    description: 'Build mileage without breaking yourself.',
    accent: 'from-sky-400 to-cyan-600',
    habits: pick('run', 'zone-2', 'stretch', 'foam-roll', 'sleep-7-hours')
  },
  {
    id: 'eat-better',
    name: 'Eat Better',
    icon: '🥗',
    description: 'Changes you could keep up for a year.',
    accent: 'from-lime-400 to-green-600',
    habits: pick('water-8', 'vegetables', 'protein-every-meal', 'cook-at-home', 'no-junk-food')
  },
  {
    id: 'sleep-reset',
    name: 'Sleep Reset',
    icon: '😴',
    description: 'The habit that makes every other habit easier.',
    accent: 'from-indigo-400 to-indigo-600',
    habits: pick(
      'same-wake-time',
      'lights-out',
      'no-screens-before-bed',
      'limit-caffeine',
      'wind-down'
    )
  },
  {
    id: 'calm-mind',
    name: 'Steadier Mind',
    icon: '🌬️',
    description: 'Practical ways to take the edge off a day.',
    accent: 'from-violet-400 to-purple-600',
    // Was 'meditate-10' and 'walking-meditation'; both were removed with the
    // meditation subcategory. What replaces them is physiological or written
    // rather than contemplative.
    habits: pick(
      'box-breathing',
      'physiological-sigh',
      'gratitude',
      'evening-reflection',
      'offline-time'
    )
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    icon: '🎯',
    description: 'Protect attention from everything competing for it.',
    accent: 'from-yellow-400 to-amber-600',
    habits: pick(
      'deep-work-block',
      'no-social-during-work',
      'phone-in-other-room',
      'top-three',
      'review-day'
    )
  },
  {
    id: 'always-learning',
    name: 'Always Learning',
    icon: '📚',
    description: 'Compound knowledge in small daily amounts.',
    accent: 'from-sky-400 to-blue-600',
    habits: pick('read-30', 'take-notes', 'practise-language', 'course-lesson', 'teach-someone')
  },
  {
    id: 'money-order',
    name: 'Money in Order',
    icon: '💰',
    description: 'Attention to money, in small regular doses.',
    accent: 'from-emerald-400 to-teal-600',
    habits: pick(
      'log-spending',
      'no-impulse-buying',
      'save-transfer',
      'budget-review',
      'cancel-subscription'
    )
  },
  {
    id: 'closer-relationships',
    name: 'Closer Relationships',
    icon: '❤️',
    description: 'Relationships need maintenance, not just goodwill.',
    accent: 'from-pink-400 to-rose-600',
    habits: pick(
      'call-family',
      'message-someone',
      'meet-in-person',
      'quality-time',
      'no-phone-at-dinner'
    )
  },
  {
    id: 'make-things',
    name: 'Make Things',
    icon: '🎨',
    description: 'Create regularly, badly at first.',
    accent: 'from-fuchsia-400 to-purple-600',
    habits: pick('write-500', 'practise-instrument', 'sketch', 'side-project', 'ship-something')
  },
  {
    id: 'home-order',
    name: 'A Calmer Home',
    icon: '🏠',
    description: 'Small daily upkeep instead of weekend blitzes.',
    accent: 'from-teal-400 to-cyan-600',
    habits: pick(
      'make-bed',
      'tidy-15',
      'dishes-before-bed',
      'declutter-one-thing',
      'prep-tomorrow'
    )
  },
  {
    id: 'clean-living',
    name: 'Clean Living',
    icon: '🌊',
    description: 'For anyone counting days.',
    accent: 'from-cyan-400 to-sky-600',
    habits: pick('no-alcohol', 'no-smoking', 'support-group', 'note-the-trigger', 'message-someone')
  },
  {
    id: 'hygiene-basics',
    name: 'Hygiene Basics',
    icon: '🧼',
    description: 'The small daily upkeep that is easy to let slide.',
    accent: 'from-sky-400 to-blue-600',
    habits: pick('brush-teeth', 'floss', 'shower', 'skincare', 'sunscreen')
  },
  {
    id: 'daily-prayer',
    name: 'Daily Prayer',
    icon: '🙏',
    description: 'A rhythm of prayer, scripture and reflection.',
    accent: 'from-amber-300 to-yellow-600',
    habits: pick('pray', 'read-scripture', 'daily-devotional', 'examen', 'attend-service')
  },
  {
    id: 'family-faith',
    name: 'Faith at Home',
    icon: '✝️',
    description: 'Practised together rather than alone.',
    accent: 'from-orange-300 to-amber-600',
    habits: pick('pray-with-family', 'daily-devotional', 'memorise-verse', 'reflection-silence', 'attend-service')
  },
  {
    id: 'desk-job',
    name: 'Desk Job Survival',
    icon: '🪑',
    description: 'Undo what eight hours in a chair does.',
    accent: 'from-slate-400 to-slate-600',
    habits: pick('stand-up-hourly', 'eye-breaks', 'hip-mobility', 'face-pulls', 'get-outside')
  },
  {
    id: 'greener',
    name: 'Lighter Footprint',
    icon: '🌱',
    description: 'Small daily choices that add up.',
    accent: 'from-green-400 to-emerald-600',
    habits: pick(
      'walk-or-cycle',
      'no-single-use-plastic',
      'meat-free-meal',
      'no-food-waste',
      'buy-secondhand'
    )
  }
];

export function findPack(id: string): HabitTemplatePack | undefined {
  return HABIT_TEMPLATE_PACKS.find(pack => pack.id === id);
}

/**
 * How the packs are shelved on the templates page.
 *
 * Twenty packs in one undifferentiated grid gave the eye nothing to hold on to
 * — Strength Basics sat beside Money in Order with nothing to say they were
 * different kinds of thing. Grouping is data rather than template logic so the
 * shelves can be reordered without touching a component.
 *
 * Membership is exhaustive and exclusive: every pack appears in exactly one
 * group, and habit-template-packs.spec.ts fails if a new pack is added without
 * being shelved. That check is the point — the failure mode otherwise is a pack
 * that exists but is unreachable, which nothing else would catch.
 */
export interface PackGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  packIds: string[];
}

export const PACK_GROUPS: PackGroup[] = [
  {
    id: 'exercise',
    name: 'Exercise',
    icon: '🏋️',
    description: 'Strength, cardio and moving more of the day.',
    packIds: ['strength-basics', 'push-pull-legs', 'no-gym', 'runner', 'desk-job']
  },
  {
    id: 'food-health',
    name: 'Food & Health',
    icon: '🥗',
    description: 'What you eat, how you sleep, what you cut.',
    packIds: ['eat-better', 'sleep-reset', 'clean-living', 'morning-routine']
  },
  {
    id: 'hygiene',
    name: 'Hygiene',
    icon: '🧼',
    description: 'The daily upkeep that is easy to let slide.',
    packIds: ['hygiene-basics']
  },
  {
    id: 'faith',
    name: 'Faith & Prayer',
    icon: '🙏',
    description: 'Prayer, scripture and reflection, alone and together.',
    packIds: ['daily-prayer', 'family-faith']
  },
  {
    id: 'focus',
    name: 'Focus & Growth',
    icon: '⚡',
    description: 'Deep work, learning and making things.',
    packIds: ['deep-focus', 'always-learning', 'make-things', 'calm-mind']
  },
  {
    id: 'home-life',
    name: 'Home & Life',
    icon: '🏠',
    description: 'Money, people, the house and the world outside it.',
    packIds: ['money-order', 'closer-relationships', 'home-order', 'greener']
  }
];

/** The packs of a group, resolved and in the group's declared order. */
export function packsInGroup(group: PackGroup): HabitTemplatePack[] {
  return group.packIds
    .map(findPack)
    .filter((pack): pack is HabitTemplatePack => pack !== undefined);
}

export function allTemplateHabits(): { pack: HabitTemplatePack; habit: LibraryHabit }[] {
  return HABIT_TEMPLATE_PACKS.flatMap(pack => pack.habits.map(habit => ({ pack, habit })));
}

/**
 * Case-insensitive name match against habits the user already has.
 *
 * Applying a pack twice should not silently produce two "Make the bed" rows —
 * the picker pre-deselects and labels anything already present.
 */
export function isAlreadyAdded(name: string, existing: { name: string }[]): boolean {
  const target = name.trim().toLowerCase();
  return existing.some(habit => habit.name.trim().toLowerCase() === target);
}
