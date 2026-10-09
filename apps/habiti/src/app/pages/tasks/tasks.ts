import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { Task, TaskStatus } from '../../models/project.model';
import { TASK_STATUS_META, taskProgress } from '../../config/task-progress';
import { STANDALONE, parseDateOnly } from '../../models/task-row.models';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TaskFormComponent, TaskFormValue } from '../../components/task-form/task-form.component';

type ListView = 'all' | 'today' | 'overdue' | 'upcoming';
type Layout = 'list' | 'board';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConfirmDialogComponent, TaskFormComponent],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class TasksComponent {
  private tasksService = inject(TasksService);
  private projectsService = inject(ProjectsService);

  protected readonly allTasks = this.tasksService.tasks;
  protected readonly projects = this.projectsService.projects;
  protected readonly STANDALONE = STANDALONE;
  protected readonly statusMeta = TASK_STATUS_META;
  protected readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

  // UI state. Signals, because the filtered list below is a computed and has to
  // recompute when any of them changes.
  protected readonly showCreateTask = signal(false);
  protected readonly view = signal<ListView>('all');
  protected readonly layout = signal<Layout>('list');
  protected readonly filterPriority = signal<string>('all');
  protected readonly filterCompleted = signal<string>('pending');
  protected readonly filterProject = signal<string>('all');
  protected readonly sortBy = signal<'title' | 'dueDate' | 'priority' | 'created'>('dueDate');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly pendingDelete = signal<Task | null>(null);

  protected readonly counts = computed(() => ({
    all: this.tasksService.tasks().length,
    today: this.tasksService.todaysTasks().length,
    overdue: this.tasksService.overdueTasks().length,
    upcoming: this.tasksService.upcomingTasks().length
  }));

  protected readonly stats = computed(() => this.tasksService.getTaskStats());

  /**
   * The visible tasks.
   *
   * A `computed`, not a method called from the template. As a method it ran on
   * every change-detection pass — several times per frame, per binding — and
   * it sorted the array IN PLACE, mutating the signal's own value behind its
   * back. Sorting a copy is the other half of that fix.
   */
  protected readonly visibleTasks = computed(() => {
    let tasks: Task[];
    switch (this.view()) {
      case 'today':
        tasks = this.tasksService.todaysTasks();
        break;
      case 'overdue':
        tasks = this.tasksService.overdueTasks();
        break;
      case 'upcoming':
        tasks = this.tasksService.upcomingTasks();
        break;
      default:
        tasks = this.tasksService.tasks();
    }

    const priority = this.filterPriority();
    if (priority !== 'all') tasks = tasks.filter(t => t.priority === priority);

    const completed = this.filterCompleted();
    if (completed === 'completed') tasks = tasks.filter(t => t.completed);
    else if (completed === 'pending') tasks = tasks.filter(t => !t.completed);

    const project = this.filterProject();
    if (project !== 'all') tasks = tasks.filter(t => (t.projectId || STANDALONE) === project);

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const by = this.sortBy();

    return [...tasks].sort((a, b) => direction * compareTasks(a, b, by));
  });

  /**
   * The visible tasks, split into sections: the ones that stand on their own,
   * then one section per project.
   *
   * A single flat list with a project dropdown made "what is this task part
   * of?" a per-row question — the answer was a small tag you had to read on
   * each line. Sections answer it once, at the top of the group, and make the
   * shape of the week obvious: three loose errands, eleven things inside the
   * launch.
   *
   * Only projects that HAVE a visible task get a section. An empty heading for
   * every project someone has ever made is noise, and the filters above would
   * produce a page of them.
   */
  protected readonly sections = computed(() => {
    const tasks = this.visibleTasks();
    const standalone = tasks.filter(task => (task.projectId || STANDALONE) === STANDALONE);

    const projects = this.projectsService
      .projects()
      .map(project => ({
        project,
        tasks: tasks.filter(task => task.projectId === project.id)
      }))
      .filter(group => group.tasks.length > 0);

    /**
     * Tasks whose project has gone — the row still points at an id nothing
     * answers to. They would otherwise vanish from this page entirely, which
     * is how a task gets lost rather than finished.
     */
    const known = new Set(this.projectsService.projects().map(project => project.id));
    const orphaned = tasks.filter(
      task => task.projectId && task.projectId !== STANDALONE && !known.has(task.projectId)
    );

    return { standalone, projects, orphaned };
  });

  /** The board's columns, each already filtered by everything above. */
  protected readonly board = computed(() => {
    const tasks = this.visibleTasks();
    return this.statuses.map(status => ({
      status,
      meta: TASK_STATUS_META[status],
      tasks: tasks.filter(task => (task.status ?? (task.completed ? 'done' : 'todo')) === status)
    }));
  });

  // --- actions -------------------------------------------------------------

  protected createTask(value: TaskFormValue): void {
    this.tasksService.createTask({
      ...value,
      // parseDateOnly, NOT new Date(string): `new Date('2026-08-20')` is
      // midnight UTC, which is the day before for anyone west of Greenwich.
      dueDate: parseDateOnly(value.dueDate)
    });
    this.showCreateTask.set(false);
  }

  protected toggleTask(taskId: string): void {
    this.tasksService.toggleTask(taskId);
  }

  protected setStatus(taskId: string, status: TaskStatus): void {
    this.tasksService.setStatus(taskId, status);
  }

  protected confirmDelete(task: Task): void {
    this.pendingDelete.set(task);
  }

  protected deleteConfirmed(): void {
    const task = this.pendingDelete();
    if (task) this.tasksService.deleteTask(task.id);
    this.pendingDelete.set(null);
  }

  // --- display helpers -----------------------------------------------------

  protected progress(task: Task): number {
    return taskProgress(task);
  }

  /**
   * A task's status label and colours.
   *
   * A method rather than `statusMeta[task.status ?? …]` in the template: the
   * row markup lives in an `<ng-template>` so both sections can share it, and
   * a template's `let-` binding is untyped — indexing a typed map with it fails
   * the AOT build. Resolving it here keeps the type and drops a ternary that
   * was repeated three times.
   */
  protected statusOf(task: Task) {
    return TASK_STATUS_META[task.status ?? (task.completed ? 'done' : 'todo')];
  }

  /** How far along a project's visible tasks are — the number beside its heading. */
  protected sectionProgress(tasks: Task[]): number {
    if (tasks.length === 0) return 0;
    return Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length);
  }

  protected projectTitle(projectId: string): string | null {
    if (!projectId || projectId === STANDALONE) return null;
    return this.projectsService.getProject(projectId)?.title || 'Project';
  }

  protected getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[priority] || '#6b7280';
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  protected isOverdue(date: Date | undefined): boolean {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  protected isDueToday(date: Date | undefined): boolean {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  }
}

function compareTasks(a: Task, b: Task, by: 'title' | 'dueDate' | 'priority' | 'created'): number {
  switch (by) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'dueDate':
      // Undated tasks sort last in ascending order rather than first.
      return (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER);
    case 'priority': {
      const order = { low: 1, medium: 2, high: 3, urgent: 4 };
      return order[a.priority] - order[b.priority];
    }
    case 'created':
      return a.createdAt.getTime() - b.createdAt.getTime();
  }
}
