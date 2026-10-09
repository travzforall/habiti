import { Injectable, inject } from '@angular/core';
import { Project } from '../models/project.model';
import { NestingRefusal, canAddChild } from '../config/project-tree';
import { STANDALONE } from '../models/task-row.models';
import { ProjectsService } from './projects.service';
import { TasksService } from './tasks.service';
import { ProjectBudgetService } from './project-budget.service';
import { AttachmentsService } from './attachments.service';

/**
 * Turning a task into a sub-project.
 *
 * ── WHY THIS IS ITS OWN SERVICE ───────────────────────────────────────────
 *
 * It began inside ProjectsService, which is the obvious home until you look at
 * what it needs: the budget service to move items and expenses, and the
 * attachments service to move files — and the latter pulls in the uploader and
 * the storage-limit service.
 *
 * ProjectsService is built on the dashboard, for every account, on every load.
 * Importing that chain there put roughly nine kilobytes of upload machinery
 * into the INITIAL bundle to serve one action, and pushed the app past its
 * budget. `verify:bundle` caught it, which is exactly what it is for.
 *
 * So the orchestration lives at the edge, injected only by the task page —
 * which is behind a lazy route and already has all three. Nothing eager
 * imports any of it.
 */
@Injectable({ providedIn: 'root' })
export class TaskPromotionService {
  private projects = inject(ProjectsService);
  private tasks = inject(TasksService);
  private budget = inject(ProjectBudgetService);
  private attachments = inject(AttachmentsService);

  /** Whether this task could become a sub-project of the project it is in. */
  canPromote(taskId: string): boolean {
    const task = this.tasks.getTask(taskId);
    if (!task?.projectId || task.projectId === STANDALONE) return false;
    return this.projects.canTakeSubProject(task.projectId);
  }

  /**
   * "Floors" starts as one line on a list and turns out to be a job with its
   * own materials, budget and six tasks. This is that moment.
   *
   * It has to carry everything across or it is a delete with extra steps:
   *
   *   - the title, description, BUDGET, priority and due date become the new
   *     project's;
   *   - its items and expenses move over, losing their task link but keeping
   *     every figure, so nothing falls out of the roll-up;
   *   - its files follow;
   *   - the task is deleted LAST, once everything it owned has a new home.
   *
   * Refuses rather than half-doing it when the parent is already at the
   * deepest level, and says which rule was hit.
   */
  promote(taskId: string): { ok: true; project: Project } | NestingRefusal {
    const task = this.tasks.getTask(taskId);
    if (!task) {
      return { ok: false, reason: 'missing', message: 'That task no longer exists.' };
    }

    const parentId = task.projectId && task.projectId !== STANDALONE ? task.projectId : undefined;
    const parent = parentId ? this.projects.getProject(parentId) : undefined;
    if (!parent || !parentId) {
      return {
        ok: false,
        reason: 'missing',
        message: 'A standalone task has no project to sit inside. Move it to one first.'
      };
    }

    const check = canAddChild(parentId, this.projects.projects());
    if (!check.ok) return check;

    const project = this.projects.createProject({
      title: task.title,
      description: task.description,
      parentId,
      type: parent.type,
      currency: parent.currency,
      budget: task.budget,
      priority: task.priority,
      dueDate: task.dueDate,
      status: 'planning'
    });

    for (const item of this.budget.itemsForTask(taskId)) {
      this.budget.updateItem(item.id, { projectId: project.id, taskId: undefined });
    }
    for (const expense of this.budget.expensesForTask(taskId)) {
      this.budget.updateExpense(expense.id, { projectId: project.id, taskId: undefined });
    }
    for (const attachment of this.attachments.forParent('task', taskId)) {
      this.attachments.reassign(attachment.id, 'project', project.id);
    }

    this.tasks.deleteTask(taskId);
    return { ok: true, project };
  }
}
