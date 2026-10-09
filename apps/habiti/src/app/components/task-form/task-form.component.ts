import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project, Task, TaskStatus } from '../../models/project.model';
import { STANDALONE, toDateOnly } from '../../models/task-row.models';
import { TASK_STATUS_META } from '../../config/task-progress';

/**
 * What the form hands back.
 *
 * `dueDate` is a STRING — `yyyy-mm-dd`, exactly what `<input type="date">`
 * holds — and stays one all the way to the caller, which converts it with
 * `parseDateOnly`. Doing it here with `new Date(value)` is the off-by-one-day
 * bug: that constructor reads a bare date as midnight UTC, which is the
 * previous day for anyone west of Greenwich.
 */
export interface TaskFormValue {
  title: string;
  description?: string;
  priority: Task['priority'];
  status: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  projectId: string;
  /** The milestone this task belongs to, when its project has any. */
  milestoneId?: string;
  progressPct?: number;
}

/**
 * One form, three hosts: the quick-add modal on /tasks, /tasks/new, and
 * /tasks/:id/edit. The three used to be one modal and two prompt() calls.
 */
@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="submit()" class="space-y-4">
      <div>
        <label [attr.for]="ids.title" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Title <span class="text-red-500">*</span>
        </label>
        <input
          [id]="ids.title"
          name="title"
          [(ngModel)]="title"
          required
          autocomplete="off"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        @if (showTitleError()) {
          <p class="mt-1 text-sm text-red-600">A task needs a title.</p>
        }
      </div>

      <div>
        <label [attr.for]="ids.description" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Description
        </label>
        <textarea
          [id]="ids.description"
          name="description"
          [(ngModel)]="description"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label [attr.for]="ids.status" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
          </label>
          <select
            [id]="ids.status"
            name="status"
            [(ngModel)]="status"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            @for (option of statusOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>

        <div>
          <label [attr.for]="ids.priority" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Priority
          </label>
          <select
            [id]="ids.priority"
            name="priority"
            [(ngModel)]="priority"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label [attr.for]="ids.dueDate" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Due date
          </label>
          <input
            [id]="ids.dueDate"
            name="dueDate"
            type="date"
            [(ngModel)]="dueDate"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <div>
          <label [attr.for]="ids.project" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Project
          </label>
          <select
            [id]="ids.project"
            name="projectId"
            [ngModel]="projectId()"
            (ngModelChange)="setProject($event)"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <!-- 'standalone' is a real value, not an absence. -->
            <option [value]="STANDALONE">No project (standalone)</option>
            @for (project of projects(); track project.id) {
              <option [value]="project.id">{{ project.icon }} {{ project.title || 'Untitled project' }}</option>
            }
          </select>
        </div>
      </div>

      <!--
        The milestone, offered only when the chosen project HAS milestones.
        An always-present select reading "No milestone" on a project that has
        none is a control that can never do anything.
      -->
      @if (milestoneOptions().length > 0) {
        <div>
          <label [attr.for]="ids.milestone" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Milestone
          </label>
          <select
            [id]="ids.milestone"
            name="milestoneId"
            [(ngModel)]="milestoneId"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">Not in a milestone</option>
            @for (milestone of milestoneOptions(); track milestone.id) {
              <option [value]="milestone.id">{{ milestone.title }}</option>
            }
          </select>
          <p class="mt-1 text-xs text-slate-500">Puts it on that row of the project's timeline.</p>
        </div>
      }

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label [attr.for]="ids.estimate" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Estimated hours
          </label>
          <input
            [id]="ids.estimate"
            name="estimatedHours"
            type="number"
            min="0"
            step="0.25"
            [(ngModel)]="estimatedHours"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <div>
          <label [attr.for]="ids.actual" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Hours spent
          </label>
          <input
            [id]="ids.actual"
            name="actualHours"
            type="number"
            min="0"
            step="0.25"
            [(ngModel)]="actualHours"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
      </div>

      <div>
        <label [attr.for]="ids.tags" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Tags
        </label>
        <input
          [id]="ids.tags"
          name="tags"
          [(ngModel)]="tagText"
          placeholder="work, admin"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Separate with commas.</p>
      </div>

      <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          class="flex-1 rounded-lg bg-blue-500 py-2 font-medium text-white transition-colors hover:bg-blue-600"
        >
          {{ submitLabel() }}
        </button>
        <button
          type="button"
          (click)="cancelled.emit()"
          class="rounded-lg border border-slate-300 px-6 py-2 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  `
})
export class TaskFormComponent {
  /** The task being edited, or undefined when creating. */
  readonly task = input<Task | undefined>(undefined);
  readonly projects = input<Project[]>([]);
  readonly submitLabel = input('Save');
  /** Preselects a project — used by "add task" inside a project. */
  readonly defaultProjectId = input<string>(STANDALONE);
  /** Preselects a milestone — used by "add task" on a milestone. */
  readonly defaultMilestoneId = input<string>('');

  readonly saved = output<TaskFormValue>();
  readonly cancelled = output<void>();
  /** Emits on every keystroke so a host can warn before discarding an edit. */
  readonly dirtyChange = output<boolean>();

  protected readonly STANDALONE = STANDALONE;
  protected readonly statusOptions = (
    ['todo', 'in_progress', 'blocked', 'done'] as TaskStatus[]
  ).map(value => ({ value, label: TASK_STATUS_META[value].label }));

  private readonly uid = Math.random().toString(36).slice(2, 8);
  protected readonly ids = {
    title: `task-title-${this.uid}`,
    description: `task-description-${this.uid}`,
    status: `task-status-${this.uid}`,
    priority: `task-priority-${this.uid}`,
    dueDate: `task-due-${this.uid}`,
    project: `task-project-${this.uid}`,
    estimate: `task-estimate-${this.uid}`,
    actual: `task-actual-${this.uid}`,
    tags: `task-tags-${this.uid}`,
    milestone: `task-milestone-${this.uid}`
  };

  // Plain fields rather than signals: ngModel writes to them directly, and this
  // form has no derived state that has to react to a keystroke.
  protected title = '';
  protected description = '';
  protected status: TaskStatus = 'todo';
  protected priority: Task['priority'] = 'medium';
  protected dueDate = '';
  /**
   * A signal, unlike the other fields: the milestone list below is derived from
   * it, so it has to be something a computed can watch.
   */
  protected readonly projectId = signal(STANDALONE);
  protected milestoneId = '';
  protected estimatedHours?: number;
  protected actualHours?: number;
  protected tagText = '';

  private readonly attempted = signal(false);
  protected readonly showTitleError = computed(() => this.attempted() && !this.title.trim());

  /** The chosen project's milestones. Empty for standalone, or a project with none. */
  protected readonly milestoneOptions = computed(() => {
    const project = this.projects().find(item => item.id === this.projectId());
    return [...(project?.milestones ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected setProject(projectId: string): void {
    this.projectId.set(projectId);
    // A milestone belongs to one project; carrying it across would put the task
    // on a timeline row that is not this project's.
    if (!this.milestoneOptions().some(milestone => milestone.id === this.milestoneId)) {
      this.milestoneId = '';
    }
  }

  constructor() {
    // Refills whenever the task arrives — a detail page resolves it after the
    // component is already on screen.
    effect(() => {
      const task = this.task();
      this.title = task?.title ?? '';
      this.description = task?.description ?? '';
      this.status = task?.status ?? (task?.completed ? 'done' : 'todo');
      this.priority = task?.priority ?? 'medium';
      this.dueDate = toDateOnly(task?.dueDate) ?? '';
      this.projectId.set(task?.projectId || this.defaultProjectId());
      this.milestoneId = task?.milestoneId ?? this.defaultMilestoneId();
      this.estimatedHours = task?.estimatedHours;
      this.actualHours = task?.actualHours;
      this.tagText = (task?.tags ?? []).join(', ');
      this.attempted.set(false);
    });
  }

  protected submit(): void {
    this.attempted.set(true);
    const title = this.title.trim();
    if (!title) return;

    this.saved.emit({
      title,
      description: this.description.trim() || undefined,
      priority: this.priority,
      status: this.status,
      dueDate: this.dueDate || undefined,
      estimatedHours: numberOrUndefined(this.estimatedHours),
      actualHours: numberOrUndefined(this.actualHours),
      tags: this.tagText
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
      projectId: this.projectId() || STANDALONE,
      milestoneId: this.milestoneId || undefined
    });
  }
}

function numberOrUndefined(value: number | undefined): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) return undefined;
  // Two decimal places: Baserow rejects the WHOLE ROW on excess decimals.
  return Math.round(Number(value) * 100) / 100;
}
