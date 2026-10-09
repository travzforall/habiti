import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Task, TaskStatus } from '../models/project.model';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { SyncBus } from '@habiti/sync';
import {
  STANDALONE,
  UserTaskRow,
  fromTask,
  keepWhatTheServerCannotStore,
  toTask
} from '../models/task-row.models';
import { addDependency, blockersOf, blocking, isBlocked } from '../config/dependencies';

/**
 * Every task this account has — standalone AND inside projects.
 *
 * ONE STORE, deliberately. Tasks used to live in two places: this service held
 * standalone ones from table 631, while ProjectsService kept each project's
 * tasks in an array inside the project's local cache, which never reached the
 * server at all. So a project's tasks did not exist on another device, could not
 * appear in "due today", and the same task could not move between the two
 * worlds. `project_id` on the row is what a task belongs to; 'standalone' is a
 * real value, not an absence (see database-schemas/28-user-tasks.json).
 *
 * ProjectsService now reads its tasks from here.
 */
@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private readonly STORAGE_KEY = 'habiti_standalone_tasks';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);

  private get tableId(): number {
    return this.baserow.tables.userTasks;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  // --- state ---------------------------------------------------------------

  private _tasks = signal<Task[]>([]);

  /**
   * Local id → server row id, for tasks created in this session.
   *
   * A new task gets a generated id, is shown immediately, and adopts the real
   * row id when the create request comes back. Anything that grabbed the first
   * id in between — and the edit page does exactly that, navigating to
   * /tasks/<id> the moment it saves — would otherwise be pointing at a task
   * that no longer exists under that name, and the detail page would say so.
   *
   * A signal rather than a plain Map so a lookup re-runs when the id lands.
   */
  private _aliases = signal<Record<string, string>>({});

  /** Every task, whatever it belongs to. */
  public readonly tasks = this._tasks.asReadonly();

  /** Follows an id through any adoption that has happened since. */
  resolveId(taskId: string): string {
    const aliases = this._aliases();
    let id = taskId;
    // A short chain at most, but a `while` costs nothing and cannot loop:
    // an alias always points at a server id, which is never a key.
    while (aliases[id]) id = aliases[id];
    return id;
  }

  /** Tasks belonging to no project. What /tasks shows by default. */
  public readonly standaloneTasks = computed(() =>
    this._tasks().filter(task => (task.projectId || STANDALONE) === STANDALONE)
  );

  /**
   * Due-date views span ALL tasks, not just standalone ones.
   *
   * A deadline is a deadline whether or not the task happens to sit in a
   * project; the dashboard asking "what is due today" and getting half an
   * answer was a side effect of the old split store, not a decision.
   */
  public readonly todaysTasks = computed(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return this._tasks().filter(task => {
      if (task.completed) return false;
      // No due date means "whenever" — those belong on the list, not in Today.
      return !!task.dueDate && task.dueDate <= endOfToday;
    });
  });

  public readonly overdueTasks = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this._tasks().filter(task => !task.completed && task.dueDate && task.dueDate < today);
  });

  public readonly upcomingTasks = computed(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const nextWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this._tasks().filter(
      task => !task.completed && task.dueDate && task.dueDate > endOfToday && task.dueDate <= nextWeek
    );
  });

  constructor() {
    this.loadTasks();
  }

  // --- reads ---------------------------------------------------------------

  getTask(taskId: string): Task | undefined {
    const id = this.resolveId(taskId);
    return this._tasks().find(t => t.id === id);
  }

  tasksForProject(projectId: string): Task[] {
    return this._tasks().filter(task => task.projectId === projectId);
  }

  /** The tasks a milestone is made of. */
  tasksForMilestone(milestoneId: string): Task[] {
    return this._tasks().filter(task => task.milestoneId === milestoneId);
  }

  // --- dependencies --------------------------------------------------------
  //
  // `dependencies` holds the tasks that must finish first. Everything else —
  // what is blocked, what a task is holding up — is derived from that one list.
  // See config/dependencies.ts.

  /** The prerequisites of this task that are not finished yet. */
  blockersFor(taskId: string): Task[] {
    const task = this.getTask(taskId);
    return task ? blockersOf(asDependent(task), this.dependents()).map(d => d.task) : [];
  }

  /** Everything waiting on this task. */
  blockedBy(taskId: string): Task[] {
    const task = this.getTask(taskId);
    return task ? blocking(asDependent(task), this.dependents()).map(d => d.task) : [];
  }

  isBlocked(taskId: string): boolean {
    return this.blockersFor(taskId).length > 0;
  }

  /**
   * Makes this task wait for another.
   *
   * Returns false when it would make a loop — two tasks each waiting for the
   * other is not a plan, and anything walking the chain would follow it
   * forever. Refused, never repaired.
   */
  addDependency(taskId: string, prerequisiteId: string): boolean {
    const next = addDependency(this.dependents(), this.resolveId(taskId), this.resolveId(prerequisiteId));
    if (!next) return false;

    this.updateTask(taskId, { dependencies: next });
    return true;
  }

  removeDependency(taskId: string, prerequisiteId: string): void {
    const task = this.getTask(taskId);
    if (!task) return;
    this.updateTask(taskId, {
      dependencies: (task.dependencies ?? []).filter(id => id !== prerequisiteId)
    });
  }

  /** The tasks, in the shape the dependency helpers work on. */
  private dependents(): DependentTask[] {
    return this._tasks().map(asDependent);
  }

  /**
   * Fetches ONE task, for a deep link opened with a cold cache.
   *
   * Landing on /tasks/482 in a fresh tab used to show "not found" until the
   * full list happened to arrive. The row is merged into the store so the rest
   * of the app sees it too.
   */
  loadOne(taskId: string): Observable<Task | null> {
    const rowId = Number(taskId);
    if (!this.tableId || !Number.isFinite(rowId)) return of(this.getTask(taskId) ?? null);
    const userId = this.userId();

    return this.baserow.getRow<UserTaskRow>(this.tableId, rowId).pipe(
      map(row => {
        /**
         * OWNERSHIP IS CHECKED HERE, and it has to be.
         *
         * `getRow` fetches by row id and cannot take a filter, and a row id in
         * a URL is trivially guessable — /tasks/1, /tasks/2. Without this,
         * typing another number would render another account's task.
         */
        if (!row) return null;
        if (userId && String(row.user_id ?? '') !== userId) return null;
        return toTask(row);
      }),
      tap(task => {
        if (task) this.merge(task);
      })
    );
  }

  /** Folds one server task into the store without losing local sub-collections. */
  private merge(task: Task): void {
    this._tasks.update(list =>
      list.some(t => t.id === task.id)
        ? list.map(t =>
            t.id === task.id ? { ...task, checklist: t.checklist, attachments: t.attachments } : t
          )
        : [...list, task]
    );
    this.saveTasks();
  }

  getTasksByPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): Task[] {
    return this._tasks().filter(task => task.priority === priority);
  }

  getTasksByTag(tag: string): Task[] {
    return this._tasks().filter(task => task.tags?.includes(tag));
  }

  getCompletedTasks(): Task[] {
    return this._tasks().filter(task => task.completed);
  }

  getPendingTasks(): Task[] {
    return this._tasks().filter(task => !task.completed);
  }

  getTaskStats() {
    const tasks = this._tasks();
    const completed = tasks.filter(t => t.completed).length;

    return {
      total: tasks.length,
      completed,
      pending: tasks.length - completed,
      overdue: this.overdueTasks().length,
      upcoming: this.upcomingTasks().length,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
    };
  }

  // --- writes --------------------------------------------------------------

  createTask(taskData: Partial<Task>): Task {
    const status = taskData.status ?? (taskData.completed ? 'done' : 'todo');

    const task: Task = {
      id: this.generateId(),
      projectId: taskData.projectId || STANDALONE,
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      completed: status === 'done',
      status,
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: status === 'done' ? new Date() : undefined,
      assignee: taskData.assignee,
      tags: taskData.tags || [],
      estimatedHours: taskData.estimatedHours,
      actualHours: taskData.actualHours,
      progressPct: taskData.progressPct,
      sortOrder: taskData.sortOrder,
      // Carried through on CREATE, not just on update: picking a milestone in
      // the new-task form was otherwise dropped the moment the task was made.
      milestoneId: taskData.milestoneId,
      dependencies: taskData.dependencies || [],
      budget: taskData.budget,
      subtasks: taskData.subtasks || [],
      checklist: taskData.checklist || [],
      attachments: taskData.attachments || [],
      comments: taskData.comments || []
    };

    this._tasks.update(tasks => [...tasks, task]);
    this.saveTasks();
    this.persist(task);
    return task;
  }

  /**
   * Applies an update, keeping `completed` and `status` in step.
   *
   * They are two views of one fact and the app edits both: the checkbox in the
   * list sets `completed`, the status control on the detail page sets `status`.
   * Reconciling here rather than at each call site is what stops a task that
   * says "Done" from having an unticked box.
   */
  updateTask(taskId: string, updates: Partial<Task>): void {
    const id = this.resolveId(taskId);
    this._tasks.update(tasks =>
      tasks.map(task => (task.id === id ? reconcile(task, updates) : task))
    );
    this.saveTasks();

    const updated = this._tasks().find(t => t.id === id);
    if (updated) this.persist(updated);
  }

  deleteTask(taskId: string): void {
    const id = this.resolveId(taskId);
    this._tasks.update(tasks => tasks.filter(task => task.id !== id));
    this.saveTasks();
    this.remove(id);
  }

  toggleTask(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task) return;
    this.updateTask(task.id, { completed: !task.completed });
  }

  setStatus(taskId: string, status: TaskStatus): void {
    this.updateTask(taskId, { status });
  }

  /** Moves a task to another project, or to 'standalone'. */
  moveToProject(taskId: string, projectId: string): void {
    this.updateTask(taskId, { projectId: projectId || STANDALONE });
  }

  /**
   * Adds elapsed time to `actual_hours`.
   *
   * Additive rather than "set", because time is logged in sessions and the
   * caller should not have to read-modify-write a shared number.
   */
  logHours(taskId: string, hours: number): void {
    const task = this.getTask(taskId);
    if (!task || !Number.isFinite(hours) || hours <= 0) return;
    // Two decimal places: Baserow REJECTS THE WHOLE ROW on excess decimals.
    const total = Math.round(((task.actualHours ?? 0) + hours) * 100) / 100;
    this.updateTask(taskId, { actualHours: total });
  }

  // --- persistence ---------------------------------------------------------

  /**
   * Loads this account's tasks from Baserow.
   *
   * The local cache is the fallback, not the source: it keeps the list on
   * screen while the request is in flight and if it fails, so a flaky network
   * shows stale tasks rather than an empty page.
   */
  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    this.baserow
      .listAllRows<UserTaskRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const cached = new Map(this._tasks().map(t => [t.id, t]));
          this._tasks.set(
            (rows ?? []).map(row => {
              const mapped = toTask(row);
              const local = cached.get(mapped.id);
              if (!local) return mapped;

              // Sub-collections come from their own services; a row read here
              // must not blank a checklist or an attachment list.
              return keepWhatTheServerCannotStore(
                { ...mapped, checklist: local.checklist, attachments: local.attachments },
                local,
                row
              );
            })
          );
          this.saveTasks();
        },
        error: err => console.warn('TasksService: could not load tasks.', err)
      });
  }

  /** Mirrors one task to Baserow. Failure never blocks the UI. */
  private persist(task: Task): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    const data = fromTask(task, userId);
    const rowId = Number(task.id);

    // A numeric id means the row already exists; a generated local id does not.
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<UserTaskRow>(this.tableId, rowId, data)
      : this.baserow.createRow<UserTaskRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          // Adopt the server id so the next edit updates rather than duplicates,
          // and leave a forwarding address for anything still holding the old one.
          const serverId = String(row.id);
          this._tasks.update(list =>
            list.map(t => (t.id === task.id ? { ...t, id: serverId } : t))
          );
          this._aliases.update(aliases => ({ ...aliases, [task.id]: serverId }));
          this.saveTasks();
        }
        this.syncBus.touched('tasks');
      },
      error: err => console.warn('TasksService: task not persisted.', err)
    });
  }

  private remove(taskId: string): void {
    const rowId = Number(taskId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      next: () => this.syncBus.touched('tasks'),
      error: err => console.warn('TasksService: task not deleted on the server.', err)
    });
  }

  /** Re-reads this account's tasks. Called when the signed-in user changes. */
  reload(): void {
    this._tasks.set([]);
    this.loadTasks();
    this.loadFromServer();
  }

  private loadTasks(): void {
    try {
      const stored = this.storage.readRaw(this.STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        this._tasks.set(tasks.map(reviveDates));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      this._tasks.set([]);
    }
  }

  private saveTasks(): void {
    try {
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(this._tasks()));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

/**
 * A task, seen as "something that waits on other things".
 *
 * The dependency helpers are generic over that shape so tasks and milestones
 * can share them; this is the adapter, and it carries the task along so the
 * caller gets Tasks back rather than ids.
 */
interface DependentTask {
  id: string;
  completed: boolean;
  dependsOn?: string[];
  task: Task;
}

function asDependent(task: Task): DependentTask {
  return { id: task.id, completed: task.completed, dependsOn: task.dependencies, task };
}

/** JSON has no dates. Everything the cache holds as a date has to come back as one. */
function reviveDates(task: Task & Record<string, unknown>): Task {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    status: task.status ?? (task.completed ? 'done' : 'todo')
  };
}

/**
 * Merges an update, deriving whichever of `completed`/`status` the caller did
 * not set, and stamping `completedAt` on the transition into done.
 */
function reconcile(task: Task, updates: Partial<Task>): Task {
  const merged: Task = { ...task, ...updates, updatedAt: new Date() };

  if (updates.status !== undefined) {
    merged.completed = updates.status === 'done';
  } else if (updates.completed !== undefined) {
    merged.status = updates.completed ? 'done' : task.status === 'done' ? 'todo' : task.status;
  }

  const nowDone = merged.completed && !task.completed;
  const nowUndone = !merged.completed && task.completed;
  if (nowDone) merged.completedAt = new Date();
  if (nowUndone) merged.completedAt = undefined;

  return merged;
}
