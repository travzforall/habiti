import { ProjectType } from '../models/project.model';

/**
 * The kinds of project, and what each one looks like.
 *
 * One place, so a type means the same thing on the list, the header, the
 * timeline and the picker. A colour per type is what stops five projects being
 * five identical blue cards — and on the timeline it is what tells one
 * project's bars from another at a glance.
 *
 * A CLOSED SET, deliberately. Free text becomes forty spellings of "work", and
 * a Baserow single_select rejects any value not in its options anyway — so an
 * unknown type read from a row falls back to `personal` rather than failing.
 */
export interface ProjectTypeMeta {
  readonly label: string;
  readonly icon: string;
  readonly colour: string;
  /** One line, shown under the picker, so the choice is not a guess. */
  readonly hint: string;
}

export const PROJECT_TYPES: Record<ProjectType, ProjectTypeMeta> = {
  personal: {
    label: 'Personal',
    icon: '🌱',
    colour: '#10b981',
    hint: 'Something you are doing for yourself'
  },
  work: {
    label: 'Work',
    icon: '💼',
    colour: '#3b82f6',
    hint: 'Your job — deliverables, deadlines, other people'
  },
  business: {
    label: 'Business',
    icon: '🚀',
    colour: '#8b5cf6',
    hint: 'Something you are building or running'
  },
  study: {
    label: 'Study',
    icon: '📚',
    colour: '#f59e0b',
    hint: 'A course, an exam, a subject you are working through'
  },
  home: {
    label: 'Home',
    icon: '🏠',
    colour: '#0ea5e9',
    hint: 'The house, the move, the garage'
  },
  creative: {
    label: 'Creative',
    icon: '🎨',
    colour: '#ec4899',
    hint: 'Writing, music, making things'
  },
  health: {
    label: 'Health',
    icon: '🫀',
    colour: '#ef4444',
    hint: 'Training, recovery, treatment'
  }
};

export const PROJECT_TYPE_ORDER: readonly ProjectType[] = [
  'personal',
  'work',
  'business',
  'study',
  'home',
  'creative',
  'health'
];

/** Never throws on a value from a row: an unknown type reads as personal. */
export function projectTypeMeta(type: string | undefined): ProjectTypeMeta {
  return PROJECT_TYPES[(type as ProjectType) ?? 'personal'] ?? PROJECT_TYPES.personal;
}

export function isProjectType(value: string): value is ProjectType {
  return value in PROJECT_TYPES;
}
