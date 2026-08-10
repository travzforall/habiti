/**
 * The habit library.
 *
 * One catalogue of every habit Habiti knows about, organised by category and
 * subcategory. Template packs and challenge suggestions are both built FROM
 * this list rather than each carrying their own copies — otherwise "Read for 30
 * minutes" exists three times with three different point values and three
 * descriptions, and fixing one fixes none of the others.
 *
 * In code, not Baserow, for the same reason as the challenge catalogue: it is
 * content that should be reviewed and pinned to a release, and it must work for
 * a brand-new user before any table exists.
 */

import { TrackingSpec } from './tracking';

/** How to actually do the thing. Shown in the habit's detail popup. */
export interface HabitGuidance {
  /** One or two sentences on what good execution looks like. */
  summary?: string;
  /** Ordered steps. Written so someone who has never done it can follow. */
  steps?: string[];
  /** Things that make it easier or more effective. */
  tips?: string[];
  /** What people get wrong — usually more useful than the steps. */
  mistakes?: string[];
  /** Kit needed. Empty means none. */
  equipment?: string[];
  /** Exercises only: what it trains. */
  muscles?: string[];
  /** Shown prominently. Use for anything that can cause injury. */
  safety?: string;
  /**
   * Illustrations are NOT bundled.
   *
   * Photographs of exercise form are licensed material, and inventing URLs
   * would ship broken images. `searchQuery` gives the UI something honest to
   * offer — a link out — until real assets are licensed. `imageUrl` is here so
   * that dropping them in later needs no schema change.
   */
  media?: {
    imageUrl?: string;
    videoUrl?: string;
    /** Used to build a "watch how" link. */
    searchQuery?: string;
  };
}

export interface LibraryHabit {
  /** Stable slug. Packs and challenges reference habits by this. */
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'good' | 'bad';
  difficulty: 'easy' | 'medium' | 'hard';
  /** Multiples of 5, matching the points selector's steps. */
  points: number;
  goal: number;
  /** What `goal` counts. Free text so it can read naturally. */
  unit?: string;
  categoryId: string;
  subcategoryId: string;
  tags?: string[];
  /**
   * What gets recorded on check-in. Omitted means "derive it from `unit` and
   * `goal`", which covers most habits — see trackingFor().
   */
  tracking?: TrackingSpec;
  guidance?: HabitGuidance;
}

export interface LibrarySubcategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface LibraryCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Tailwind gradient for headers, matching the template cards. */
  accent: string;
  subcategories: LibrarySubcategory[];
}

export interface LibrarySection {
  category: LibraryCategory;
  habits: LibraryHabit[];
}

/**
 * Builder for library entries.
 *
 * Every habit needs nine fields and most of them repeat within a subcategory,
 * so writing them out longhand hides the differences that matter in a wall of
 * boilerplate.
 */
export function habit(
  id: string,
  name: string,
  icon: string,
  description: string,
  over: Partial<LibraryHabit> = {}
): LibraryHabit {
  return {
    id,
    name,
    icon,
    description,
    type: 'good',
    difficulty: 'medium',
    points: 10,
    goal: 1,
    categoryId: '',
    subcategoryId: '',
    ...over
  };
}

/** Stamps category and subcategory onto a group of habits. */
export function group(
  categoryId: string,
  subcategoryId: string,
  habits: LibraryHabit[]
): LibraryHabit[] {
  return habits.map(h => ({ ...h, categoryId, subcategoryId }));
}

export function sub(
  id: string,
  name: string,
  icon: string,
  description: string
): LibrarySubcategory {
  return { id, name, icon, description };
}
