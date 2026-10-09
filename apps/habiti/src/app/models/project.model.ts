/**
 * Where a task is, not how far along it is.
 *
 * `blocked` is a status rather than a flag on purpose: it is the thing worth
 * seeing at a glance on a board, and a blocked task is not "in progress".
 */
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  id: string;
  /** A `user_projects` row id, or the literal 'standalone'. */
  projectId: string;
  title: string;
  description?: string;
  /**
   * Kept as a mirror of `status === 'done'`.
   *
   * It is the column the table has carried since day one and half the app
   * reads it, so it stays — but `status` is what the UI edits, and the two are
   * written together. Never set one without the other.
   */
  completed: boolean;
  status?: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
  assignee?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  /** Hand-set 0–100. Only meaningful when there is no checklist — see taskProgress(). */
  progressPct?: number;
  /** Manual ordering within a list. */
  sortOrder?: number;
  /** The milestone this task belongs to, if any. One milestone per task. */
  milestoneId?: string;
  /**
   * What this one task is meant to cost.
   *
   * The same plan-only figure a project has. Its spending is the items and
   * expenses tagged with this task, and both also belong to the project — so a
   * task's money shows in its own budget AND in its project's, without being
   * counted twice. See config/budget-math.ts.
   */
  budget?: number;
  /**
   * Tasks that must be finished before this one can start.
   *
   * Stored on the waiting task, like a milestone's `dependsOn`. A task with an
   * unfinished prerequisite is BLOCKED — shown, never enforced: people work out
   * of order for good reasons, and the app's job is to make that visible rather
   * than to argue.
   */
  dependencies?: string[];
  subtasks?: Task[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  completedAt?: Date;
}

/**
 * A stage of a project, with a shape in time.
 *
 * `startDate` is what makes a milestone a BAR on the timeline rather than a
 * point: "Migration, September to October" is a thing you can see slipping,
 * where "Migration, due 31 October" is only ever late or not late yet.
 * Milestones without one are drawn as a marker on their target date.
 *
 * Which tasks belong to it is stored on the TASK (`milestoneId`), not as a list
 * here — a task belongs to one milestone, so that is a property of the task,
 * and one write moves it rather than two lists needing to agree.
 */
/**
 * How a milestone is going, beyond done or not done.
 *
 * `at_risk` is the one that earns its place: a milestone nobody has touched and
 * one that is in trouble look identical on a timeline until someone says so.
 */
export type MilestoneStatus = 'planned' | 'active' | 'at_risk' | 'done';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  startDate?: Date;
  targetDate: Date;
  completed: boolean;
  completedAt?: Date;
  status?: MilestoneStatus;
  /** Who is accountable. A name, not a user id — nothing here is shared yet. */
  owner?: string;
  /** What has to be true before this can be called done. */
  definitionOfDone?: string;
  /**
   * Milestones that must finish before this one can move.
   *
   * Stored on the WAITING milestone; "what is waiting on me" is derived. See
   * config/dependencies.ts.
   */
  dependsOn?: string[];
  colour?: string;
  sortOrder: number;
  /** Legacy, local-only. Membership lives on the task; see the note above. */
  tasks: string[];
  /** Derived from its tasks. Stored on the row so a list can draw a bar cheaply. */
  progress: number;
}

export interface Goal {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string; // e.g., "tasks", "hours", "%"
  deadline?: Date;
  achieved: boolean;
  achievedAt?: Date;
  category?: 'quality' | 'productivity' | 'learning' | 'deadline' | 'other';
}

/**
 * What kind of project this is.
 *
 * Not decoration: the type carries a default colour and icon, groups the
 * project list, and is the honest answer to "why do these two things look the
 * same when one is a house move and the other is a product launch". Kept as a
 * short closed set — a free-text field would become forty spellings of "work".
 */
export type ProjectType =
  | 'personal'
  | 'work'
  | 'business'
  | 'study'
  | 'home'
  | 'creative'
  | 'health';

export interface Project {
  id: string;
  title: string;
  description?: string;
  type: ProjectType;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  owner?: string;
  team?: string[];
  tasks: Task[];
  milestones: Milestone[];
  goals: Goal[];
  tags?: string[];
  color?: string;
  icon?: string;
  archived?: boolean;
  /** 0-100, rolled up from this project's tasks. Stored so a list can draw a bar cheaply. */
  progress: number;
  /**
   * What this project is meant to cost. The PLAN, and only the plan.
   *
   * This used to be `{ estimated, spent, currency }`, with `spent` stored
   * alongside it — a number that can disagree with the expenses it is supposed
   * to summarise, and nothing wrote it. Spending is now the sum of
   * project_expenses (38) and what is still promised is the unbought
   * project_items (37); both are derived. See config/budget-math.ts.
   */
  budget?: number;
  /** ISO code for the budget and its expenses. Blank means the app default. */
  currency?: string;
  /**
   * The project this one sits inside.
   *
   * Three levels at most — see config/project-tree.ts, which owns that rule and
   * refuses a move rather than silently reparenting anything.
   */
  parentId?: string;
  /**
   * Where it sits among its siblings, when someone has dragged it.
   *
   * Undefined means never placed by hand, and those sort after everything that
   * was — see config/ordering.ts.
   */
  sortOrder?: number;
}

/**
 * What an attachment is, decided once at upload from the MIME type, so that
 * every place that renders one agrees. `link` covers a URL with no file behind
 * it — a doc in someone else's drive, a reference — which is worth keeping
 * next to real files rather than buried in the description.
 */
export type AttachmentKind = 'image' | 'video' | 'document' | 'link';

export interface Attachment {
  id: string;
  parentType: 'task' | 'project';
  parentId: string;
  kind: AttachmentKind;
  filename: string;
  url: string;
  /** Baserow's own thumbnail, images only. Absent for everything else. */
  thumbnailUrl?: string;
  mimeType?: string;
  size: number;
  width?: number;
  height?: number;
  caption?: string;
  /**
   * The opaque name Baserow gave the stored file.
   *
   * The only handle by which the file itself could ever be deleted. Deleting
   * the row does NOT delete the file — see the note in AttachmentsService.
   */
  baserowName?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface Comment {
  id: string;
  text: string;
  author?: string;
  createdAt: Date;
  editedAt?: Date;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
  totalMilestones: number;
  completedMilestones: number;
  totalGoals: number;
  achievedGoals: number;
  averageTaskCompletionTime: number; // in hours
  productivity: number; // 0-100 score
}