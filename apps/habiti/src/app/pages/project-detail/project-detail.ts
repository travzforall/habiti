import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ProjectsService } from '../../services/projects.service';
import { TasksService } from '../../services/tasks.service';
import { AttachmentsService } from '../../services/attachments.service';
import { InspirationService } from '../../services/inspiration.service';
import { MindMapService } from '../../services/mind-map.service';
import { ToastService } from '../../services/toast.service';
import { Goal, Milestone, Project, Task, TaskStatus } from '../../models/project.model';
import { TASK_STATUS_META, taskProgress } from '../../config/task-progress';
import { MilestoneStatus } from '../../models/project.model';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AttachmentPanelComponent } from '../../components/attachment-panel/attachment-panel.component';
import { TaskFormComponent, TaskFormValue } from '../../components/task-form/task-form.component';
import { InspirationBoardComponent } from '../../components/inspiration-board/inspiration-board.component';
import { ProjectTimelineComponent } from '../../components/project-timeline/project-timeline.component';
import { ProjectBudgetPanelComponent } from '../../components/project-budget/project-budget-panel.component';
import { ProjectPlansPanelComponent } from '../../components/project-plans/project-plans-panel.component';
import { projectTypeMeta } from '../../config/project-types';
import { parseDateOnly, toDateOnly } from '../../models/task-row.models';

/**
 * One project: what it is, what is in it, and how far along it is.
 *
 * Its tasks come from TasksService filtered on `project_id` — the same rows
 * /tasks shows — so a task added here appears there, counts towards "due
 * today", and survives a different browser. Milestones and goals are still
 * local-cache-only; there is no table for them yet and the UI says so rather
 * than pretending.
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConfirmDialogComponent,
    AttachmentPanelComponent,
    TaskFormComponent,
    InspirationBoardComponent,
    ProjectTimelineComponent,
    ProjectBudgetPanelComponent,
    ProjectPlansPanelComponent
  ],
  templateUrl: './project-detail.html'
})
export class ProjectDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectsService = inject(ProjectsService);
  private tasksService = inject(TasksService);
  private attachments = inject(AttachmentsService);
  private inspiration = inject(InspirationService);
  private mindMaps = inject(MindMapService);
  private toast = inject(ToastService);

  protected readonly statusMeta = TASK_STATUS_META;
  protected readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

  private readonly projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly fetchState = signal<'idle' | 'loading' | 'missing'>('idle');
  protected readonly showAddTask = signal(false);
  /** Set when "Add task" is pressed on a milestone, so the form opens on it. */
  protected readonly addTaskMilestone = signal('');
  protected readonly pendingDelete = signal(false);
  protected readonly hideCompleted = signal(false);

  // Milestone and goal drafts. Plain fields: ngModel writes them directly and
  // nothing derives from them.
  protected newMilestoneTitle = '';
  protected newMilestoneDate = '';
  protected newMilestoneStart = '';
  protected newMilestoneColour = '';

  /**
   * Which milestone is open for editing, and the draft while it is.
   *
   * A milestone could only be named and dated at the moment it was created —
   * after that the panel offered a tick and a delete. Everything a milestone
   * has is editable here now: what it is called, what it covers, when it runs,
   * and what colour it takes on the timeline.
   */
  protected readonly editingMilestone = signal<string | null>(null);
  protected editTitle = '';
  protected editDescription = '';
  protected editStart = '';
  protected editTarget = '';
  protected editColour = '';
  protected editOwner = '';
  protected editDefinitionOfDone = '';
  protected editStatus: MilestoneStatus = 'planned';

  /** The swatches offered for a milestone. Empty means "the project's type colour". */
  protected readonly milestoneColours = ['', '#0ea5e9', '#8b5cf6', '#16a34a', '#f59e0b', '#ef4444'];
  protected newGoalTitle = '';
  protected newGoalTarget?: number;
  protected newGoalUnit = 'tasks';

  /** Through the alias — see ProjectsService.resolveId. */
  protected readonly project = computed(() => {
    this.projectsService.projects();
    return this.projectsService.getProject(this.projectId());
  });

  protected readonly tasks = computed(() => {
    const tasks = this.tasksService.tasksForProject(this.project()?.id ?? this.projectId());
    return this.hideCompleted() ? tasks.filter(t => !t.completed) : tasks;
  });

  /** This project's own maps. */
  protected readonly maps = computed(() =>
    this.mindMaps.mapsForBoard(this.project()?.id ?? this.projectId())
  );

  protected readonly stats = computed(() => this.projectsService.getProjectStats(this.project()?.id ?? this.projectId()));
  protected readonly projects = this.projectsService.projects;

  /**
   * This project's tasks, grouped by the milestone they belong to.
   *
   * The same argument as sections on /tasks: which milestone a task is part of
   * was a small select at the end of each row, so the shape of the project —
   * four things left in Migration, none started — could only be assembled by
   * reading every line. Milestones keep their timeline order; anything
   * unassigned goes last, never hidden.
   */
  protected readonly taskGroups = computed(() => {
    const tasks = this.tasks();
    const milestones = [...(this.project()?.milestones ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.targetDate.getTime() - b.targetDate.getTime()
    );

    const groups = milestones
      .map(milestone => ({
        milestone,
        tasks: tasks.filter(task => task.milestoneId === milestone.id)
      }))
      .filter(group => group.tasks.length > 0);

    const known = new Set(milestones.map(milestone => milestone.id));
    const loose = tasks.filter(task => !task.milestoneId || !known.has(task.milestoneId));

    return { groups, loose };
  });

  protected readonly board = computed(() => {
    const tasks = this.tasks();
    return this.statuses.map(status => ({
      status,
      meta: TASK_STATUS_META[status],
      tasks: tasks.filter(task => (task.status ?? (task.completed ? 'done' : 'todo')) === status)
    }));
  });

  constructor() {
    const id = this.projectId();
    if (id && !this.project()) {
      this.fetchState.set('loading');
      this.projectsService.loadOne(id).subscribe({
        next: found => this.fetchState.set(found ? 'idle' : 'missing'),
        error: () => this.fetchState.set('missing')
      });
    }
    this.attachments.loadForParent('project', id);
    this.inspiration.loadBoard(id);
    this.mindMaps.loadMaps(id);
  }

  // --- actions -------------------------------------------------------------

  protected addTask(value: TaskFormValue): void {
    this.projectsService.createTask(this.project()?.id ?? this.projectId(), {
      ...value,
      dueDate: parseDateOnly(value.dueDate)
    });
    this.showAddTask.set(false);
    this.addTaskMilestone.set('');
    this.toast.success('Task added to this project');
  }

  /** Opens the form with a milestone already chosen. */
  protected addTaskTo(milestoneId: string): void {
    this.addTaskMilestone.set(milestoneId);
    this.showAddTask.set(true);
  }

  protected milestoneTitle(milestoneId: string | undefined): string | null {
    if (!milestoneId) return null;
    return this.project()?.milestones.find(m => m.id === milestoneId)?.title ?? null;
  }

  /** Creates a map inside this project and opens it. */
  protected createMap(): void {
    const project = this.project();
    if (!project) return;
    const map = this.mindMaps.createMap(project.id, `${project.title || 'Project'} map`);
    this.router.navigate(['/maps', map.id]);
  }

  // --- milestones and goals ------------------------------------------------
  //
  // These moved here from the inline detail view that used to live on
  // /projects. They are still LOCAL-ONLY — there is no table for either, and
  // the tab says so on screen rather than letting someone assume otherwise.

  protected addMilestone(): void {
    const title = this.newMilestoneTitle.trim();
    const project = this.project();
    if (!title || !project) return;

    this.projectsService.createMilestone(project.id, {
      title,
      // parseDateOnly, not new Date(string) — a bare date string is UTC midnight.
      startDate: parseDateOnly(this.newMilestoneStart),
      targetDate: parseDateOnly(this.newMilestoneDate) ?? new Date(),
      colour: this.newMilestoneColour || undefined
    });
    this.newMilestoneTitle = '';
    this.newMilestoneDate = '';
    this.newMilestoneStart = '';
    this.newMilestoneColour = '';
  }

  /** Opens a milestone for editing, filling the draft from it. */
  protected editMilestone(milestone: Milestone): void {
    this.editingMilestone.set(milestone.id);
    this.editTitle = milestone.title;
    this.editDescription = milestone.description ?? '';
    this.editStart = toDateOnly(milestone.startDate) ?? '';
    this.editTarget = toDateOnly(milestone.targetDate) ?? '';
    this.editColour = milestone.colour ?? '';
    this.editOwner = milestone.owner ?? '';
    this.editDefinitionOfDone = milestone.definitionOfDone ?? '';
    this.editStatus = milestone.status ?? (milestone.completed ? 'done' : 'planned');
  }

  protected readonly milestoneStatuses: { value: MilestoneStatus; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'active', label: 'In progress' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'done', label: 'Done' }
  ];

  /** The milestones this one could wait on: any other in the project. */
  protected otherMilestones(milestoneId: string): Milestone[] {
    return (this.project()?.milestones ?? []).filter(item => item.id !== milestoneId);
  }

  protected milestoneBlockers(milestoneId: string): Milestone[] {
    const project = this.project();
    return project ? this.projectsService.milestoneBlockers(project.id, milestoneId) : [];
  }

  protected dependsOnTitles(milestone: Milestone): Milestone[] {
    const all = this.project()?.milestones ?? [];
    return (milestone.dependsOn ?? [])
      .map(id => all.find(item => item.id === id))
      .filter((item): item is Milestone => !!item);
  }

  protected toggleMilestoneDependency(milestoneId: string, prerequisiteId: string): void {
    const project = this.project();
    if (!project) return;

    const milestone = project.milestones.find(item => item.id === milestoneId);
    if (milestone?.dependsOn?.includes(prerequisiteId)) {
      this.projectsService.removeMilestoneDependency(project.id, milestoneId, prerequisiteId);
      return;
    }

    if (!this.projectsService.addMilestoneDependency(project.id, milestoneId, prerequisiteId)) {
      // The only reason it can fail, and worth saying rather than doing nothing.
      this.toast.info('That would have them waiting on each other');
    }
  }

  protected isDependency(milestone: Milestone, prerequisiteId: string): boolean {
    return (milestone.dependsOn ?? []).includes(prerequisiteId);
  }

  /** A task with an unfinished prerequisite, for the badge on its row. */
  protected taskBlockers(taskId: string): Task[] {
    return this.tasksService.blockersFor(taskId);
  }

  protected saveMilestone(milestoneId: string): void {
    const project = this.project();
    const title = this.editTitle.trim();
    if (!project || !title) return;

    this.projectsService.updateMilestone(project.id, milestoneId, {
      title,
      description: this.editDescription.trim() || undefined,
      startDate: parseDateOnly(this.editStart),
      // A milestone without a target has no place on the timeline, so an empty
      // field keeps what was there rather than clearing it.
      targetDate: parseDateOnly(this.editTarget) ?? undefined,
      colour: this.editColour || undefined,
      owner: this.editOwner.trim() || undefined,
      definitionOfDone: this.editDefinitionOfDone.trim() || undefined,
      status: this.editStatus,
      // Ticking through the status keeps the checkbox honest, and the other way
      // round is handled by toggleMilestone.
      completed: this.editStatus === 'done'
    });
    this.editingMilestone.set(null);
  }

  protected moveMilestone(milestoneId: string, direction: -1 | 1): void {
    const project = this.project();
    if (project) this.projectsService.moveMilestone(project.id, milestoneId, direction);
  }

  protected toggleMilestone(milestone: Milestone): void {
    const project = this.project();
    if (!project) return;
    this.projectsService.updateMilestone(project.id, milestone.id, {
      completed: !milestone.completed
    });
  }

  protected deleteMilestone(milestoneId: string): void {
    const project = this.project();
    if (!project) return;
    this.projectsService.deleteMilestone(project.id, milestoneId);
  }

  protected addGoal(): void {
    const title = this.newGoalTitle.trim();
    const project = this.project();
    if (!title || !project) return;

    this.projectsService.createGoal(project.id, {
      title,
      targetValue: this.newGoalTarget,
      currentValue: 0,
      unit: this.newGoalUnit || 'tasks'
    });
    this.newGoalTitle = '';
    this.newGoalTarget = undefined;
  }

  protected toggleGoal(goal: Goal): void {
    const project = this.project();
    if (!project) return;
    this.projectsService.updateGoal(project.id, goal.id, { achieved: !goal.achieved });
  }

  protected deleteGoal(goalId: string): void {
    const project = this.project();
    if (!project) return;
    this.projectsService.deleteGoal(project.id, goalId);
  }

  protected goalProgress(goal: Goal): number {
    if (!goal.targetValue) return goal.achieved ? 100 : 0;
    return Math.min(100, Math.round(((goal.currentValue || 0) / goal.targetValue) * 100));
  }

  protected toggleTask(taskId: string): void {
    this.projectsService.toggleTask(this.project()?.id ?? this.projectId(), taskId);
  }

  protected deleteConfirmed(): void {
    const project = this.project();
    this.pendingDelete.set(false);
    if (!project) return;

    this.projectsService.deleteProject(project.id);
    this.toast.success(
      'Project deleted',
      project.tasks.length > 0 ? 'Its tasks are now standalone.' : undefined
    );
    this.router.navigate(['/projects']);
  }

  // --- display -------------------------------------------------------------

  protected progress(task: Task): number {
    return taskProgress(task);
  }

  /**
   * A task's status label and colours.
   *
   * Same reason as on /tasks: the row markup lives in an `<ng-template>` so
   * both groupings can share it, and a template's `let-` binding is untyped —
   * indexing a typed map with it fails the AOT build.
   */
  protected statusOf(task: Task) {
    return TASK_STATUS_META[task.status ?? (task.completed ? 'done' : 'todo')];
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

  protected priorityColor(priority: string): string {
    const colors: Record<string, string> = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[priority] || '#6b7280';
  }

  protected statusLabel(status: string): string {
    return status.replace('-', ' ');
  }

  /** The project's type, for the badge in the header. */
  protected readonly typeMeta = computed(() => projectTypeMeta(this.project()?.type));

  /** Which milestone a task is in, if any — the select on each task row. */
  protected assignMilestone(taskId: string, milestoneId: string): void {
    this.projectsService.assignTaskToMilestone(taskId, milestoneId || undefined);
  }

  protected milestoneOf(task: Task): string {
    return task.milestoneId ?? '';
  }

  /** How many of a milestone's tasks are done — shown beside it in the list. */
  protected milestoneTasks(milestoneId: string): Task[] {
    return this.tasksService.tasksForMilestone(milestoneId);
  }

  /** Scrolls the Milestones card into view when a timeline row is clicked. */
  /**
   * The budget figure lives on the project row, so the panel asks and this
   * saves — one owner for each piece of data, and the panel stays a view of
   * money rather than a second place projects get written.
   */
  // --- sub-projects ---------------------------------------------------------

  protected readonly showSubForm = signal(false);
  protected subProjectTitle = '';

  protected readonly ancestors = computed(() => {
    // Furthest ancestor first: a path reads top-down, the service answers
    // nearest-first because that is the cheaper walk.
    const id = this.projectId();
    return id ? [...this.projectsService.ancestorsOf(id)].reverse() : [];
  });

  protected readonly subProjects = computed(() => {
    const id = this.projectId();
    return id ? this.projectsService.subProjectsOf(id) : [];
  });

  protected readonly canTakeSubProject = computed(() => {
    const id = this.projectId();
    return id ? this.projectsService.canTakeSubProject(id) : false;
  });

  protected addSubProject(parent: Project): void {
    const title = this.subProjectTitle.trim();
    if (!title) return;

    // It inherits the parent's type, so the colour and icon match without
    // anyone choosing them twice.
    this.projectsService.createProject({
      title,
      parentId: parent.id,
      type: parent.type,
      currency: parent.currency
    });

    this.subProjectTitle = '';
    this.showSubForm.set(false);
  }

  protected setBudget(projectId: string, budget: number | undefined): void {
    this.projectsService.updateProject(projectId, { budget });
  }

  protected focusMilestone(milestoneId: string): void {
    document.getElementById('milestone-' + milestoneId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}
