import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Goal, Milestone, Project, ProjectStats, ProjectType, Task } from '../models/project.model';
import { projectTypeMeta } from '../config/project-types';
import { addDependency, blockersOf, blocking } from '../config/dependencies';
import { byOrder, moveItem, renumber } from '../config/ordering';
import {
  MAX_PROJECT_DEPTH,
  NestingCheck,
  TreeRow,
  ancestorsOf,
  canAddChild,
  canNest,
  depthOf,
  treeOf,
  withDescendants
} from '../config/project-tree';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { SyncBus } from '@habiti/sync';
import { UserProjectRow, fromProject, toProject } from '../models/task-row.models';
import { MilestoneRow, fromMilestone, toMilestone } from '../models/milestone-row.models';
import { TasksService } from './tasks.service';
import { projectProgress } from '../config/task-progress';

/**
 * A user's projects.
 *
 * ── WHERE A PROJECT'S TASKS COME FROM ─────────────────────────────────────
 *
 * Not from here. This service used to keep each project's tasks in an array
 * inside the project, cached in localStorage and never written to any table —
 * so they existed on one browser only, could not appear in "due today", and no
 * task could move between a project and standalone.
 *
 * Tasks now live in TasksService, in table 631, with `project_id` saying what
 * they belong to. `projects` below fills each project's `tasks` from there on
 * read, which keeps every existing template working while there is exactly one
 * store underneath.
 *
 * Milestones now live in table 638 and are loaded and written there. GOALS are
 * the last thing still local-cache-only.
 *
 * ── WHAT HAPPENS TO MILESTONES MADE BEFORE THE TABLE EXISTED ──────────────
 *
 * They are pushed up on the first load that finds the table, not deleted. A
 * server list that comes back empty is ambiguous — "this account has no
 * milestones" and "this table is new" look identical — and resolving that
 * ambiguity by wiping the only copy would lose a project's whole timeline. So
 * anything local that the server has never seen is CREATED there instead.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private readonly STORAGE_KEY = 'habiti_projects';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);
  private tasksService = inject(TasksService);

  /** `project_milestones` (638). Zero until db:setup has run — see warnNoTable. */
  private get milestonesTable(): number {
    return this.baserow.tables?.projectMilestones ?? 0;
  }

  private warnedNoMilestoneTable = false;

  private get tableId(): number {
    return this.baserow.tables.userProjects;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  // --- state ---------------------------------------------------------------

  /** Project rows. Their `tasks` arrays are empty here and filled on read. */
  private _projects = signal<Project[]>([]);
  private _selectedProjectId = signal<string | null>(null);

  /**
   * Local id → server row id, for projects created in this session. Same
   * reasoning as TasksService: the edit page navigates to /projects/<id> the
   * instant it saves, which is before the row id has come back.
   */
  private _aliases = signal<Record<string, string>>({});

  resolveId(projectId: string): string {
    const aliases = this._aliases();
    let id = projectId;
    while (aliases[id]) id = aliases[id];
    return id;
  }

  public readonly projects = computed(() =>
    this._projects().map(project => this.withTasks(project))
  );

  public readonly selectedProject = computed(() => {
    const projectId = this._selectedProjectId();
    return projectId ? this.projects().find(p => p.id === projectId) || null : null;
  });

  public readonly activeProjects = computed(() =>
    this.projects().filter(p => p.status === 'active' && !p.archived)
  );

  public readonly completedProjects = computed(() =>
    this.projects().filter(p => p.status === 'completed')
  );

  constructor() {
    this.loadProjects();
  }

  /** A project with its tasks and its live progress, which is what callers want. */
  private withTasks(project: Project): Project {
    const tasks = this.tasksService.tasksForProject(project.id);
    return { ...project, tasks, progress: projectProgress(tasks) };
  }

  // --- project CRUD --------------------------------------------------------

  createProject(projectData: Partial<Project>): Project {
    const type: ProjectType = projectData.type ?? 'personal';
    const meta = projectTypeMeta(type);

    const id = this.generateId();
    const project: Project = {
      id,
      title: projectData.title || 'New Project',
      description: projectData.description || '',
      type,
      status: projectData.status || 'planning',
      priority: projectData.priority || 'medium',
      startDate: projectData.startDate,
      dueDate: projectData.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: projectData.owner,
      team: projectData.team || [],
      tasks: [],
      milestones: [],
      goals: [],
      tags: projectData.tags || [],
      // The type's colour and icon, unless the user picked their own.
      color: projectData.color || meta.colour,
      icon: projectData.icon || meta.icon,
      archived: false,
      progress: 0,
      budget: projectData.budget,
      currency: projectData.currency,
      // A parent that would break the depth rule is dropped rather than
      // refused: the project itself is what was asked for, and it appears at
      // the top level where it can be seen and moved.
      parentId:
        projectData.parentId && canAddChild(projectData.parentId, this._projects()).ok
          ? projectData.parentId
          : undefined
    };

    this._projects.update(projects => [...projects, project]);
    this.saveProjects();
    this.persist(project);
    return project;
  }

  updateProject(projectId: string, updates: Partial<Project>): void {
    this._projects.update(projects =>
      projects.map(project =>
        project.id === projectId ? { ...project, ...updates, updatedAt: new Date() } : project
      )
    );
    this.saveProjects();

    const updated = this._projects().find(p => p.id === projectId);
    if (updated) this.persist(updated);
  }

  /**
   * Deletes a project. Its tasks are kept and made standalone.
   *
   * Deleting someone's work as a side effect of tidying up a container is not a
   * decision this service gets to make quietly. The UI says what will happen
   * before it happens.
   */
  deleteProject(projectId: string): void {
    for (const task of this.tasksService.tasksForProject(projectId)) {
      this.tasksService.moveToProject(task.id, 'standalone');
    }

    // Sub-projects move up a level rather than going with it.
    this.liftChildren(projectId);

    this._projects.update(projects => projects.filter(p => p.id !== projectId));
    if (this._selectedProjectId() === projectId) {
      this._selectedProjectId.set(null);
    }
    this.saveProjects();
    this.removeRow(projectId);
  }

  selectProject(projectId: string): void {
    this._selectedProjectId.set(projectId);
  }

  // --- task operations, delegated to the one task store --------------------

  createTask(projectId: string, taskData: Partial<Task>): Task {
    const task = this.tasksService.createTask({ ...taskData, projectId });
    this.updateProjectProgress(projectId);
    return task;
  }

  updateTask(projectId: string, taskId: string, updates: Partial<Task>): void {
    this.tasksService.updateTask(taskId, updates);
    this.updateProjectProgress(projectId);
  }

  deleteTask(projectId: string, taskId: string): void {
    this.tasksService.deleteTask(taskId);
    this.updateProjectProgress(projectId);
  }

  toggleTask(projectId: string, taskId: string): void {
    this.tasksService.toggleTask(taskId);
    this.updateProjectProgress(projectId);
  }

  // --- sub-projects ---------------------------------------------------------

  /**
   * The projects directly inside this one.
   *
   * Reads through `projects()` so each one arrives with its tasks and live
   * progress, the same as any other project — a sub-project is a project.
   */
  subProjectsOf(projectId: string): Project[] {
    return this.projects()
      .filter(project => project.parentId === projectId)
      .sort(byOrder((a, b) => a.title.localeCompare(b.title)));
  }

  /**
   * Moves a sub-project among its siblings, and writes the new order down.
   *
   * The whole group is renumbered 1..n and only the rows that actually changed
   * are saved — see config/ordering.ts for why fractional orders were not used.
   */
  reorderSubProjects(parentId: string, from: number, to: number): void {
    const siblings = this.subProjectsOf(parentId);
    const moved = moveItem(siblings, from, to);

    for (const { item, sortOrder } of renumber(moved)) {
      this.updateProject(item.id, { sortOrder });
    }
  }

  /** The chain up to the top, nearest parent first. The breadcrumb. */
  ancestorsOf(projectId: string): Project[] {
    const project = this.getProject(projectId);
    return project ? ancestorsOf(project, this.projects()) : [];
  }

  /** This project and everything under it — what a roll-up covers. */
  familyOf(projectId: string): Project[] {
    return withDescendants(projectId, this.projects());
  }

  depthOf(projectId: string): number {
    const project = this.getProject(projectId);
    return project ? depthOf(project, this._projects()) : 1;
  }

  /** Whether this project can take another level below it. */
  canTakeSubProject(projectId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;
    return depthOf(project, this._projects()) < MAX_PROJECT_DEPTH;
  }

  /** The whole set as a flat list in reading order, each row knowing its depth. */
  tree(): TreeRow<Project>[] {
    return treeOf(this.projects(), (a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Moves a project under another, or back to the top with no parent.
   *
   * Returns the refusal rather than throwing, so the caller can say WHICH rule
   * was hit — the fix for "too deep" and the fix for "that would loop" are
   * different things.
   */
  setParent(projectId: string, parentId: string | undefined): NestingCheck {
    const check = canNest(projectId, parentId, this._projects());
    if (!check.ok) return check;

    this.updateProject(projectId, { parentId });
    return check;
  }

  /**
   * Deletes a project. Its sub-projects are LIFTED, not deleted with it.
   *
   * Same reasoning as a milestone releasing its tasks: removing a heading is
   * not a decision to destroy everything filed under it, and a project full of
   * work disappearing because its parent went is not recoverable from the UI.
   */
  private liftChildren(projectId: string): void {
    for (const child of this._projects().filter(project => project.parentId === projectId)) {
      this.updateProject(child.id, { parentId: undefined });
    }
  }

  // --- milestones and goals (local cache only, no table yet) ---------------

  createMilestone(projectId: string, milestoneData: Partial<Milestone>): Milestone {
    const existing = this.getProject(projectId)?.milestones ?? [];

    const milestone: Milestone = {
      id: this.generateId(),
      projectId,
      title: milestoneData.title || 'New Milestone',
      description: milestoneData.description || '',
      // A start date is optional: with one the milestone is a bar on the
      // timeline, without one it is a marker on its target date.
      startDate: milestoneData.startDate,
      targetDate: milestoneData.targetDate || new Date(),
      completed: false,
      colour: milestoneData.colour,
      sortOrder:
        milestoneData.sortOrder ??
        (existing.length > 0 ? Math.max(...existing.map(m => m.sortOrder ?? 0)) + 1 : 1),
      tasks: milestoneData.tasks || [],
      progress: 0
    };

    const project = this.getProject(projectId);
    if (project) {
      this.updateProject(projectId, { milestones: [...project.milestones, milestone] });
      this.persistMilestone(milestone);
    }

    return milestone;
  }

  updateMilestone(projectId: string, milestoneId: string, updates: Partial<Milestone>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedMilestones = project.milestones.map(milestone => {
      if (milestone.id === milestoneId) {
        const updatedMilestone = { ...milestone, ...updates };
        if (updates.completed !== undefined && updates.completed !== milestone.completed) {
          updatedMilestone.completedAt = updates.completed ? new Date() : undefined;
        }
        return updatedMilestone;
      }
      return milestone;
    });

    this.updateProject(projectId, { milestones: updatedMilestones });

    const updated = updatedMilestones.find(milestone => milestone.id === milestoneId);
    if (updated) this.persistMilestone(updated);
  }

  // --- milestone dependencies ----------------------------------------------

  /** The milestones this one is waiting on that are not finished. */
  milestoneBlockers(projectId: string, milestoneId: string): Milestone[] {
    const all = this.dependentMilestones(projectId);
    const target = all.find(item => item.id === milestoneId);
    return target ? blockersOf(target, all).map(item => item.milestone) : [];
  }

  /** The milestones waiting on this one. */
  milestonesBlockedBy(projectId: string, milestoneId: string): Milestone[] {
    const all = this.dependentMilestones(projectId);
    const target = all.find(item => item.id === milestoneId);
    return target ? blocking(target, all).map(item => item.milestone) : [];
  }

  /** Returns false when it would make a loop. Same rule as tasks. */
  addMilestoneDependency(projectId: string, milestoneId: string, prerequisiteId: string): boolean {
    const next = addDependency(this.dependentMilestones(projectId), milestoneId, prerequisiteId);
    if (!next) return false;

    this.updateMilestone(projectId, milestoneId, { dependsOn: next });
    return true;
  }

  removeMilestoneDependency(projectId: string, milestoneId: string, prerequisiteId: string): void {
    const milestone = this.getProject(projectId)?.milestones.find(item => item.id === milestoneId);
    if (!milestone) return;

    this.updateMilestone(projectId, milestoneId, {
      dependsOn: (milestone.dependsOn ?? []).filter(id => id !== prerequisiteId)
    });
  }

  private dependentMilestones(projectId: string) {
    return (this.getProject(projectId)?.milestones ?? []).map(milestone => ({
      id: milestone.id,
      completed: milestone.completed,
      dependsOn: milestone.dependsOn,
      milestone
    }));
  }

  /**
   * Moves a milestone up or down the list.
   *
   * That order IS the order of the timeline's rows, so this is how a project is
   * arranged into stages rather than into whatever order they were typed.
   * Swaps `sortOrder` with the neighbour, so nothing else has to be renumbered.
   */
  moveMilestone(projectId: string, milestoneId: string, direction: -1 | 1): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const ordered = [...project.milestones].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.targetDate.getTime() - b.targetDate.getTime()
    );
    const index = ordered.findIndex(milestone => milestone.id === milestoneId);
    const swapWith = ordered[index + direction];
    if (index === -1 || !swapWith) return;

    const mine = ordered[index].sortOrder;
    const theirs = swapWith.sortOrder;
    // Equal orders (everything defaulted) would swap to no effect.
    const [nextMine, nextTheirs] =
      mine === theirs ? [index + direction, index] : [theirs, mine];

    const moved = project.milestones.map(milestone => {
      if (milestone.id === milestoneId) return { ...milestone, sortOrder: nextMine };
      if (milestone.id === swapWith.id) return { ...milestone, sortOrder: nextTheirs };
      return milestone;
    });

    this.updateProject(projectId, { milestones: moved });

    // Both ends of the swap changed, so both rows have to be written.
    for (const milestone of moved) {
      if (milestone.id === milestoneId || milestone.id === swapWith.id) {
        this.persistMilestone(milestone);
      }
    }
  }

  /**
   * Deletes a milestone and releases its tasks.
   *
   * The tasks are kept — they were work before they were grouped, and deleting
   * someone's work as a side effect of removing a heading is not a decision
   * this service makes quietly.
   */
  deleteMilestone(projectId: string, milestoneId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;

    for (const task of this.tasksService.tasksForMilestone(milestoneId)) {
      this.tasksService.updateTask(task.id, { milestoneId: undefined });
    }

    this.updateProject(projectId, {
      milestones: project.milestones.filter(m => m.id !== milestoneId)
    });
    this.removeMilestoneRow(milestoneId);
  }

  /** Puts a task into a milestone, or takes it out with an empty id. */
  assignTaskToMilestone(taskId: string, milestoneId: string | undefined): void {
    this.tasksService.updateTask(taskId, { milestoneId: milestoneId || undefined });
  }

  createGoal(projectId: string, goalData: Partial<Goal>): Goal {
    const goal: Goal = {
      id: this.generateId(),
      projectId,
      title: goalData.title || 'New Goal',
      description: goalData.description || '',
      targetValue: goalData.targetValue,
      currentValue: goalData.currentValue || 0,
      unit: goalData.unit || 'tasks',
      deadline: goalData.deadline,
      achieved: false,
      category: goalData.category || 'other'
    };

    const project = this.getProject(projectId);
    if (project) {
      this.updateProject(projectId, { goals: [...project.goals, goal] });
    }

    return goal;
  }

  updateGoal(projectId: string, goalId: string, updates: Partial<Goal>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedGoals = project.goals.map(goal => {
      if (goal.id === goalId) {
        const updatedGoal = { ...goal, ...updates };
        if (updates.achieved !== undefined && updates.achieved !== goal.achieved) {
          updatedGoal.achievedAt = updates.achieved ? new Date() : undefined;
        }
        return updatedGoal;
      }
      return goal;
    });

    this.updateProject(projectId, { goals: updatedGoals });
  }

  deleteGoal(projectId: string, goalId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;
    this.updateProject(projectId, { goals: project.goals.filter(g => g.id !== goalId) });
  }

  // --- reads ---------------------------------------------------------------

  getProject(projectId: string): Project | undefined {
    const id = this.resolveId(projectId);
    return this.projects().find(p => p.id === id);
  }

  /** Fetches one project for a deep link opened with a cold cache. */
  loadOne(projectId: string): Observable<Project | null> {
    const rowId = Number(projectId);
    if (!this.tableId || !Number.isFinite(rowId)) return of(this.getProject(projectId) ?? null);
    const userId = this.userId();

    return this.baserow.getRow<UserProjectRow>(this.tableId, rowId).pipe(
      map(row => {
        // Row ids in URLs are guessable; getRow cannot filter by user. Same
        // check as TasksService.loadOne, for the same reason.
        if (!row) return null;
        if (userId && String(row.user_id ?? '') !== userId) return null;
        return toProject(row);
      }),
      tap(project => {
        if (!project) return;
        this._projects.update(list =>
          list.some(p => p.id === project.id)
            ? list.map(p =>
                p.id === project.id
                  ? { ...project, milestones: p.milestones, goals: p.goals }
                  : p
              )
            : [...list, project]
        );
        this.saveProjects();
      }),
      map(project => (project ? this.withTasks(project) : null))
    );
  }

  getProjectStats(projectId: string): ProjectStats | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    const now = new Date();
    const completedTasks = project.tasks.filter(t => t.completed).length;
    const overdueTasks = project.tasks.filter(t => !t.completed && t.dueDate && t.dueDate < now)
      .length;
    const upcomingTasks = project.tasks.filter(
      t =>
        !t.completed &&
        t.dueDate &&
        t.dueDate > now &&
        t.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    ).length;

    const completedMilestones = project.milestones.filter(m => m.completed).length;
    const achievedGoals = project.goals.filter(g => g.achieved).length;

    const completedTasksWithTime = project.tasks.filter(
      t => t.completed && t.completedAt && t.actualHours
    );
    const averageTaskCompletionTime =
      completedTasksWithTime.length > 0
        ? completedTasksWithTime.reduce((sum, t) => sum + (t.actualHours || 0), 0) /
          completedTasksWithTime.length
        : 0;

    const onTimeCompletions = project.tasks.filter(
      t => t.completed && t.dueDate && t.completedAt && t.completedAt <= t.dueDate
    ).length;
    const productivity =
      project.tasks.length > 0
        ? Math.round(((completedTasks + onTimeCompletions) / (project.tasks.length * 2)) * 100)
        : 0;

    return {
      totalTasks: project.tasks.length,
      completedTasks,
      overdueTasks,
      upcomingTasks,
      totalMilestones: project.milestones.length,
      completedMilestones,
      totalGoals: project.goals.length,
      achievedGoals,
      averageTaskCompletionTime,
      productivity: Math.min(100, productivity)
    };
  }

  /**
   * Writes the rolled-up progress back to the row.
   *
   * Display always uses the live figure from `withTasks`; this only keeps the
   * stored column in step so a list view elsewhere can draw a bar without
   * loading every task.
   */
  updateProjectProgress(projectId: string): void {
    const stored = this._projects().find(p => p.id === projectId);
    if (!stored) return;

    const progress = projectProgress(this.tasksService.tasksForProject(projectId));
    if (progress !== stored.progress) {
      this.updateProject(projectId, { progress });
    }
  }

  // --- persistence ---------------------------------------------------------

  /**
   * Loads this account's projects from Baserow.
   *
   * Milestones and goals have no table, so a server-loaded project keeps
   * whatever the local cache already holds for those rather than blanking them.
   */
  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    this.baserow
      .listAllRows<UserProjectRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const cached = new Map(this._projects().map(p => [p.id, p]));
          this._projects.set(
            (rows ?? []).map(row => {
              const mapped = toProject(row);
              const local = cached.get(mapped.id);
              return local
                ? { ...mapped, milestones: local.milestones, goals: local.goals }
                : mapped;
            })
          );
          this.saveProjects();
          // Only now: a milestone needs its project to exist first.
          this.loadMilestonesFromServer();
        },
        error: err => console.warn('ProjectsService: could not load projects.', err)
      });
  }

  private persist(project: Project): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    const data = fromProject(project, userId);
    const rowId = Number(project.id);

    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<UserProjectRow>(this.tableId, rowId, data)
      : this.baserow.createRow<UserProjectRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          // Adopt the server id, and leave a forwarding address for anything
          // still holding the local one.
          const serverId = String(row.id);
          this._projects.update(list =>
            list.map(p => (p.id === project.id ? { ...p, id: serverId } : p))
          );
          this._aliases.update(aliases => ({ ...aliases, [project.id]: serverId }));

          // Tasks created against the local id have to follow the project.
          for (const task of this.tasksService.tasksForProject(project.id)) {
            this.tasksService.moveToProject(task.id, serverId);
          }
          this.saveProjects();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectsService: project not persisted.', err)
    });
  }

  // --- milestones on the server -------------------------------------------

  /**
   * Loads this account's milestones and folds them into the projects.
   *
   * Runs after the projects themselves, because a milestone with no project to
   * belong to has nowhere to go.
   */
  private loadMilestonesFromServer(): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.milestonesTable) return void this.warnNoMilestoneTable();

    this.baserow
      .listAllRows<MilestoneRow>(this.milestonesTable, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const byProject = new Map<string, Milestone[]>();
          for (const row of rows ?? []) {
            const milestone = toMilestone(row);
            const list = byProject.get(milestone.projectId);
            if (list) list.push(milestone);
            else byProject.set(milestone.projectId, [milestone]);
          }

          // Anything local the server has never seen is kept and pushed up.
          // A local id is not a number; a row id always is.
          const toUpload: Milestone[] = [];
          this._projects.update(projects =>
            projects.map(project => {
              const fromServer = byProject.get(project.id) ?? [];
              const known = new Set(fromServer.map(milestone => milestone.id));
              const localOnly = project.milestones.filter(
                milestone => !known.has(milestone.id) && !Number.isFinite(Number(milestone.id))
              );
              toUpload.push(...localOnly.map(milestone => ({ ...milestone, projectId: project.id })));
              return { ...project, milestones: [...fromServer, ...localOnly] };
            })
          );
          this.saveProjects();

          for (const milestone of toUpload) this.persistMilestone(milestone);
          if (toUpload.length > 0) {
            console.info(`ProjectsService: uploaded ${toUpload.length} milestone(s) made before the table existed.`);
          }
        },
        error: err => console.warn('ProjectsService: could not load milestones.', err)
      });
  }

  /** Creates or updates one milestone's row. Failure never blocks the UI. */
  private persistMilestone(milestone: Milestone): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.milestonesTable) return void this.warnNoMilestoneTable();

    const data = fromMilestone(milestone, userId);
    const rowId = Number(milestone.id);

    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<MilestoneRow>(this.milestonesTable, rowId, data)
      : this.baserow.createRow<MilestoneRow>(this.milestonesTable, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) this.adoptMilestoneId(milestone, String(row.id));
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectsService: milestone not persisted.', err)
    });
  }

  /**
   * Swaps a milestone's local id for its row id, everywhere it is referenced.
   *
   * Three places, and missing any one of them silently breaks something: the
   * milestone itself, the TASKS assigned to it (they would show as belonging to
   * a milestone that no longer exists — which is exactly the case that made a
   * whole project vanish from the timeline), and the dependsOn lists of the
   * milestones waiting on it.
   */
  private adoptMilestoneId(milestone: Milestone, serverId: string): void {
    const localId = milestone.id;

    this._projects.update(projects =>
      projects.map(project => ({
        ...project,
        milestones: project.milestones.map(candidate => {
          const next =
            candidate.id === localId ? { ...candidate, id: serverId } : { ...candidate };
          if (next.dependsOn?.includes(localId)) {
            next.dependsOn = next.dependsOn.map(id => (id === localId ? serverId : id));
          }
          return next;
        })
      }))
    );

    for (const task of this.tasksService.tasksForMilestone(localId)) {
      this.tasksService.updateTask(task.id, { milestoneId: serverId });
    }

    this.saveProjects();
  }

  private removeMilestoneRow(milestoneId: string): void {
    const rowId = Number(milestoneId);
    if (!this.milestonesTable || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.milestonesTable, rowId).subscribe({
      next: () => this.syncBus.touched('projects'),
      error: err => console.warn('ProjectsService: milestone not deleted on the server.', err)
    });
  }

  private warnNoMilestoneTable(): void {
    if (this.warnedNoMilestoneTable) return;
    this.warnedNoMilestoneTable = true;
    console.warn(
      'ProjectsService: tables.projectMilestones is 0 — milestones stay on this ' +
        'browser. Create the table with: npm run db:setup -- --apply --write-env'
    );
  }

  private removeRow(projectId: string): void {
    const rowId = Number(projectId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      next: () => this.syncBus.touched('projects'),
      error: err => console.warn('ProjectsService: project not deleted on the server.', err)
    });
  }

  /** Re-reads this account's projects. Called when the signed-in user changes. */
  reload(): void {
    this._projects.set([]);
    this.loadProjects();
    this.loadFromServer();
  }

  private loadProjects(): void {
    try {
      const stored = this.storage.readRaw(this.STORAGE_KEY);
      if (!stored) return;

      const projects = JSON.parse(stored);
      this._projects.set(
        projects.map((project: Project & Record<string, unknown>) => ({
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
          completedAt: project.completedAt ? new Date(project.completedAt) : undefined,
          // Tasks are not cached here any more — they belong to TasksService.
          tasks: [],
          milestones: (project.milestones ?? []).map(milestone => ({
            ...milestone,
            targetDate: new Date(milestone.targetDate),
            // startDate is optional, and was missed here when it was added:
            // JSON.parse gives back a STRING, and the timeline calls getTime()
            // on it. A milestone with a start would push NaN into the layout
            // and take the whole bar row with it.
            startDate: milestone.startDate ? new Date(milestone.startDate) : undefined,
            completedAt: milestone.completedAt ? new Date(milestone.completedAt) : undefined
          })),
          goals: (project.goals ?? []).map(goal => ({
            ...goal,
            deadline: goal.deadline ? new Date(goal.deadline) : undefined,
            achievedAt: goal.achievedAt ? new Date(goal.achievedAt) : undefined
          }))
        }))
      );
    } catch (error) {
      console.error('Error loading projects:', error);
      this._projects.set([]);
    }
  }

  private saveProjects(): void {
    try {
      // Store the rows only. Tasks are TasksService's cache, and writing them
      // twice is how the two copies used to drift apart.
      const rows = this._projects().map(project => ({ ...project, tasks: [] }));
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
