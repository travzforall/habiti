import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { ChecklistService } from '../../services/checklist.service';
import { AttachmentsService } from '../../services/attachments.service';
import { MindMapService } from '../../services/mind-map.service';
import { Task, TaskStatus } from '../../models/project.model';
import { TASK_STATUS_META, taskProgress } from '../../config/task-progress';
import { STANDALONE } from '../../models/task-row.models';
import { ProjectBudgetService } from '../../services/project-budget.service';
import { TaskPromotionService } from '../../services/task-promotion.service';
import { SupplyPickerComponent } from '../../components/supply-picker/supply-picker.component';
import { ProjectItem } from '../../models/budget.models';
import { ProjectTool } from '../../models/tool.models';
import { ToolStatus, toolCost } from '../../config/tool-cost';
import { itemCost } from '../../config/budget-math';
import { formatMoney } from '../../config/currency';
import { CurrencyService } from '../../services/currency.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TaskChecklistComponent } from '../../components/task-checklist/task-checklist.component';
import { AttachmentPanelComponent } from '../../components/attachment-panel/attachment-panel.component';
import { ToastService } from '../../services/toast.service';

/**
 * One task, everything about it.
 *
 * The page a task row now links to. Three states matter and all three are
 * handled explicitly, because the interesting one is easy to forget: opening
 * /tasks/482 in a fresh tab, where nothing is cached and the row has to be
 * fetched before the page can say whether it exists.
 */
@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConfirmDialogComponent,
    TaskChecklistComponent,
    AttachmentPanelComponent, SupplyPickerComponent],
  templateUrl: './task-detail.html'
})
export class TaskDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tasksService = inject(TasksService);
  private budgetService = inject(ProjectBudgetService);
  private promotion = inject(TaskPromotionService);
  private currency = inject(CurrencyService);
  private projectsService = inject(ProjectsService);
  private checklist = inject(ChecklistService);
  private attachments = inject(AttachmentsService);
  private mindMaps = inject(MindMapService);
  private toast = inject(ToastService);

  protected readonly statusMeta = TASK_STATUS_META;
  protected readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
  protected readonly STANDALONE = STANDALONE;

  private readonly taskId = toSignal(this.route.paramMap.pipe(map(params => params.get('id') ?? '')), {
    initialValue: ''
  });

  /** 'loading' until the cold-cache fetch settles; then found or missing. */
  protected readonly fetchState = signal<'idle' | 'loading' | 'missing'>('idle');
  protected readonly pendingDelete = signal(false);
  protected readonly showMove = signal(false);
  protected readonly logHoursValue = signal<number | null>(null);

  /**
   * `getTask`, not a scan of the list: a task created seconds ago is still
   * under its local id in the URL, and getTask follows the alias to the row id
   * it adopted when the server answered. Reading `tasks()` inside it is what
   * keeps this computed reactive.
   */
  protected readonly task = computed(() => {
    this.tasksService.tasks();
    return this.tasksService.getTask(this.taskId());
  });

  protected readonly checklistItems = computed(() => this.checklist.forTask(this.taskId()));
  protected readonly files = computed(() => this.attachments.forParent('task', this.taskId()));

  /** The checklist lives in its own store, so fold it in before measuring. */
  protected readonly progress = computed(() => {
    const task = this.task();
    if (!task) return 0;
    return taskProgress({ ...task, checklist: this.checklistItems() });
  });

  protected readonly project = computed(() => {
    const id = this.task()?.projectId;
    return id && id !== STANDALONE ? this.projectsService.getProject(id) : undefined;
  });

  protected readonly projects = this.projectsService.projects;

  /**
   * Maps this task appears on.
   *
   * The link has to work from both ends: a task made from a branch is only
   * findable from the map otherwise, and the map is where the reasoning is.
   */
  protected readonly onMaps = computed(() => this.mindMaps.mapsForTask(this.taskId()));

  /** The milestone this task is part of, if its project has one. */
  /** What this task is waiting on that is not finished. */
  protected readonly blockers = computed(() => {
    this.tasksService.tasks();
    return this.tasksService.blockersFor(this.taskId());
  });

  /** Everything waiting on this one — the reverse view, derived. */
  protected readonly blocks = computed(() => {
    this.tasksService.tasks();
    return this.tasksService.blockedBy(this.taskId());
  });

  /** Prerequisites including the finished ones, for the list with its ticks. */
  protected readonly prerequisites = computed(() => {
    const ids = this.task()?.dependencies ?? [];
    return ids
      .map(id => this.tasksService.getTask(id))
      .filter((task): task is Task => !!task);
  });

  /** Candidates to wait on: other tasks, nearest first. */
  protected readonly dependencyChoices = computed(() => {
    const task = this.task();
    if (!task) return [];
    const chosen = new Set(task.dependencies ?? []);
    return this.tasksService
      .tasks()
      .filter(other => other.id !== task.id && !chosen.has(other.id))
      .slice(0, 50);
  });

  protected readonly showBlockerPicker = signal(false);

  // --- becoming a project ---------------------------------------------------

  /** Only a task inside a project can become a sub-project of it. */
  protected readonly canPromote = computed(() => {
    const task = this.task();
    return task ? this.promotion.canPromote(task.id) : false;
  });

  protected readonly projectName = computed(() => {
    const task = this.task();
    const project = task?.projectId ? this.projectsService.getProject(task.projectId) : undefined;
    return project?.title || 'this project';
  });

  protected promote(task: Task): void {
    const result = this.promotion.promote(task.id);

    if (!result.ok) {
      this.toast.error('Not moved', result.message);
      return;
    }

    this.toast.success('Now a sub-project', `"${result.project.title}" carries its budget, items and files.`);
    this.router.navigate(['/projects', result.project.id]);
  }

  // --- money ---------------------------------------------------------------

  protected readonly editingBudget = signal(false);
  protected budgetDraft: number | null = null;
  protected itemTitle = '';
  protected itemQuantity: number | null = 1;
  protected itemCostDraft: number | null = null;

  protected readonly taskItems = computed(() => {
    const task = this.task();
    return task ? this.budgetService.itemsForTask(task.id) : [];
  });

  protected readonly budgetSummary = computed(() => {
    const task = this.task();
    return this.budgetService.summaryForTask(task?.id ?? '', task?.budget, this.currency.table());
  });

  protected money(amount: number): string {
    return formatMoney(amount, this.currency.home());
  }

  protected itemTotal(item: ProjectItem): number {
    return itemCost(item);
  }

  protected readonly showPicker = signal(false);
  protected toolTitle = '';
  protected toolStatus: ToolStatus = 'buy';

  protected readonly taskTools = computed(() => {
    const task = this.task();
    return task ? this.budgetService.toolsForTask(task.id) : [];
  });

  protected costOfTool(tool: ProjectTool): number {
    return toolCost(tool);
  }

  protected toolClass(tool: ProjectTool): string {
    switch (tool.status) {
      case 'own':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'borrow':
        return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
      case 'hire':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      default:
        return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
  }

  protected addTool(task: Task): void {
    const title = this.toolTitle.trim();
    if (!title) return;

    this.budgetService.addTool(task.projectId || STANDALONE, {
      title,
      status: this.toolStatus,
      taskId: task.id,
      milestoneId: task.milestoneId
    });

    this.toolTitle = '';
  }

  protected toggleToolInHand(tool: ProjectTool): void {
    this.budgetService.updateTool(tool.id, { inHand: !tool.inHand });
  }

  protected removeTool(toolId: string): void {
    this.budgetService.deleteTool(toolId);
  }

  protected startEditingBudget(task: Task): void {
    this.budgetDraft = task.budget ?? null;
    this.editingBudget.set(true);
  }

  protected saveBudget(): void {
    const task = this.task();
    if (!task) return;

    this.tasksService.updateTask(task.id, { budget: this.budgetDraft ?? undefined });
    this.editingBudget.set(false);
  }

  /**
   * Adds an item to this task — and to its project.
   *
   * The project id is what makes the roll-up work: the item belongs to the
   * task for detail and to the project for the total, which is one row, not
   * two. A standalone task keeps its own list and rolls up to nothing.
   */
  protected addItem(task: Task): void {
    const title = this.itemTitle.trim();
    if (!title) return;

    this.budgetService.addItem(task.projectId || STANDALONE, {
      title,
      quantity: this.itemQuantity ?? 1,
      unitCost: this.itemCostDraft ?? undefined,
      taskId: task.id,
      milestoneId: task.milestoneId
    });

    this.itemTitle = '';
    this.itemQuantity = 1;
    this.itemCostDraft = null;
  }

  protected removeItem(itemId: string): void {
    this.budgetService.deleteItem(itemId);
  }

  protected addBlocker(prerequisiteId: string): void {
    const task = this.task();
    if (!task) return;

    if (!this.tasksService.addDependency(task.id, prerequisiteId)) {
      this.toast.info('That would have the two waiting on each other');
    }
    this.showBlockerPicker.set(false);
  }

  protected removeBlocker(prerequisiteId: string): void {
    const task = this.task();
    if (task) this.tasksService.removeDependency(task.id, prerequisiteId);
  }

  protected readonly milestone = computed(() => {
    const task = this.task();
    if (!task?.milestoneId) return undefined;
    return this.project()?.milestones.find(item => item.id === task.milestoneId);
  });

  constructor() {
    // A deep link with a cold cache: fetch the row before deciding it is gone.
    const id = this.taskId();
    if (id && !this.task()) {
      this.fetchState.set('loading');
      this.tasksService.loadOne(id).subscribe({
        next: found => this.fetchState.set(found ? 'idle' : 'missing'),
        error: () => this.fetchState.set('missing')
      });
    }

    this.checklist.loadForTask(id);
    this.attachments.loadForParent('task', id);
  }

  // --- actions -------------------------------------------------------------

  protected setStatus(status: TaskStatus): void {
    const task = this.task();
    if (!task) return;
    this.tasksService.setStatus(task.id, status);
    if (task.projectId !== STANDALONE) this.projectsService.updateProjectProgress(task.projectId);
  }

  protected toggle(): void {
    const task = this.task();
    if (!task) return;
    this.tasksService.toggleTask(task.id);
    if (task.projectId !== STANDALONE) this.projectsService.updateProjectProgress(task.projectId);
  }

  protected moveTo(projectId: string): void {
    const task = this.task();
    if (!task) return;

    const previous = task.projectId;
    this.tasksService.moveToProject(task.id, projectId);
    this.showMove.set(false);

    // Both ends of the move need their rolled-up progress rewritten.
    if (previous && previous !== STANDALONE) this.projectsService.updateProjectProgress(previous);
    if (projectId !== STANDALONE) this.projectsService.updateProjectProgress(projectId);

    this.toast.success(
      'Task moved',
      projectId === STANDALONE ? 'It is standalone now.' : 'Moved into the project.'
    );
  }

  protected logHours(): void {
    const task = this.task();
    const hours = this.logHoursValue();
    if (!task || !hours || hours <= 0) return;

    this.tasksService.logHours(task.id, hours);
    this.logHoursValue.set(null);
    this.toast.success('Time logged', `${hours}h added to this task.`);
  }

  protected deleteConfirmed(): void {
    const task = this.task();
    this.pendingDelete.set(false);
    if (!task) return;

    const projectId = task.projectId;
    this.tasksService.deleteTask(task.id);
    if (projectId && projectId !== STANDALONE) this.projectsService.updateProjectProgress(projectId);

    this.toast.success('Task deleted');
    this.router.navigate(projectId && projectId !== STANDALONE ? ['/projects', projectId] : ['/tasks']);
  }

  // --- display -------------------------------------------------------------

  protected formatDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected isOverdue(task: Task): boolean {
    if (!task.dueDate || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return task.dueDate < today;
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
}
