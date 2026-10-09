import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { ToastService } from '../../services/toast.service';
import { TaskFormComponent, TaskFormValue } from '../../components/task-form/task-form.component';
import { STANDALONE, parseDateOnly } from '../../models/task-row.models';

/**
 * Create or edit one task, on its own page.
 *
 * Both, because the form and everything around it are identical — the only
 * difference is whether there is a task to load first. /tasks/new and
 * /tasks/:id/edit both land here; the pencil in a task row points at the
 * second.
 *
 * A page rather than a modal: this form is long enough that a modal on a phone
 * becomes a scrolling box inside a scrolling page, and a URL that can be
 * linked, refreshed and reached with the back button is worth more here than a
 * dimmed background.
 */
@Component({
  selector: 'app-task-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, TaskFormComponent],
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <nav class="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <a routerLink="/tasks" class="hover:text-blue-600">Tasks</a>
        @if (task(); as task) {
          <span aria-hidden="true">/</span>
          <a [routerLink]="['/tasks', task.id]" class="max-w-xs truncate hover:text-blue-600">
            {{ task.title }}
          </a>
        }
        <span aria-hidden="true">/</span>
        <span class="text-slate-700 dark:text-slate-300">{{ isNew() ? 'New' : 'Edit' }}</span>
      </nav>

      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {{ isNew() ? 'New task' : 'Edit task' }}
        </h1>

        @if (!isNew() && !task() && fetchState() === 'loading') {
          <p class="py-8 text-center text-slate-500">Loading this task…</p>
        } @else if (!isNew() && !task()) {
          <div class="py-8 text-center">
            <p class="mb-4 text-slate-600 dark:text-slate-300">This task no longer exists.</p>
            <a routerLink="/tasks" class="font-medium text-blue-600 hover:underline">Back to tasks</a>
          </div>
        } @else {
          <app-task-form
            [task]="task()"
            [projects]="projects()"
            [defaultProjectId]="defaultProjectId()"
            [submitLabel]="isNew() ? 'Create task' : 'Save changes'"
            (saved)="save($event)"
            (cancelled)="cancel()"
          ></app-task-form>
        }
      </div>
    </div>
  `
})
export class TaskEditComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tasksService = inject(TasksService);
  private projectsService = inject(ProjectsService);
  private toast = inject(ToastService);

  private readonly taskId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id') ?? '')),
    { initialValue: '' }
  );

  /** ?project=7 preselects a project — used by "add task" inside a project. */
  private readonly queryProject = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('project') ?? STANDALONE)),
    { initialValue: STANDALONE }
  );

  protected readonly fetchState = signal<'idle' | 'loading'>('idle');
  protected readonly projects = this.projectsService.projects;

  protected readonly isNew = computed(() => !this.taskId());
  /** Through the alias — see TasksService.resolveId. */
  protected readonly task = computed(() => {
    this.tasksService.tasks();
    return this.tasksService.getTask(this.taskId());
  });
  protected readonly defaultProjectId = computed(() => this.queryProject());

  constructor() {
    const id = this.taskId();
    if (id && !this.task()) {
      this.fetchState.set('loading');
      this.tasksService.loadOne(id).subscribe({
        next: () => this.fetchState.set('idle'),
        error: () => this.fetchState.set('idle')
      });
    }
  }

  protected save(value: TaskFormValue): void {
    // parseDateOnly, not new Date(string) — see the note on TaskFormValue.
    const dueDate = parseDateOnly(value.dueDate);
    const existing = this.task();

    if (existing) {
      const previousProject = existing.projectId;
      this.tasksService.updateTask(existing.id, { ...value, dueDate });

      // A move changes the rolled-up progress at both ends.
      if (previousProject !== value.projectId) {
        if (previousProject && previousProject !== STANDALONE) {
          this.projectsService.updateProjectProgress(previousProject);
        }
      }
      if (value.projectId !== STANDALONE) {
        this.projectsService.updateProjectProgress(value.projectId);
      }

      this.toast.success('Task saved');
      this.router.navigate(['/tasks', existing.id]);
      return;
    }

    const created = this.tasksService.createTask({ ...value, dueDate });
    if (value.projectId !== STANDALONE) {
      this.projectsService.updateProjectProgress(value.projectId);
    }
    this.toast.success('Task created');
    this.router.navigate(['/tasks', created.id]);
  }

  protected cancel(): void {
    const existing = this.task();
    this.router.navigate(existing ? ['/tasks', existing.id] : ['/tasks']);
  }
}
