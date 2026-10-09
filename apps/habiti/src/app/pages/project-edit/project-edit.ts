import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ProjectsService } from '../../services/projects.service';
import { ToastService } from '../../services/toast.service';
import { Project, ProjectType } from '../../models/project.model';
import { PROJECT_TYPE_ORDER, PROJECT_TYPES, projectTypeMeta } from '../../config/project-types';
import { parseDateOnly, toDateOnly } from '../../models/task-row.models';

/**
 * Create or edit a project.
 *
 * Same shape as the task edit page — /projects/new and /projects/:id/edit both
 * land here — and the same reason for being a page rather than a modal.
 *
 * The title field is `required` and marked, which is not a formality: nine rows
 * in this table have no title at all, because the mapper used to write the
 * column under the wrong name and Baserow dropped it without complaint. Those
 * rows show as "Untitled project" throughout, and this page is where they get
 * fixed.
 */
@Component({
  selector: 'app-project-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <nav class="flex items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <a routerLink="/projects" class="hover:text-blue-600">Projects</a>
        <span aria-hidden="true">/</span>
        <span class="text-slate-700 dark:text-slate-300">{{ isNew() ? 'New' : 'Edit' }}</span>
      </nav>

      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {{ isNew() ? 'New project' : 'Edit project' }}
        </h1>

        @if (!isNew() && !project()) {
          <div class="py-8 text-center">
            <p class="mb-4 text-slate-600 dark:text-slate-300">This project no longer exists.</p>
            <a routerLink="/projects" class="font-medium text-blue-600 hover:underline">
              Back to projects
            </a>
          </div>
        } @else {
          <form (ngSubmit)="save()" class="space-y-4">
            <div>
              <label for="project-title" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Title <span class="text-red-500">*</span>
              </label>
              <input
                id="project-title"
                name="title"
                [(ngModel)]="title"
                required
                class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              @if (attempted() && !title.trim()) {
                <p class="mt-1 text-sm text-red-600">A project needs a title.</p>
              }
            </div>

            <!--
              The type comes second, right after the name, because it decides
              the project's colour and icon and how the list groups it. Buttons
              rather than a select: seven options with an icon each are quicker
              to recognise than to read.
            -->
            <div>
              <span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Type
              </span>
              <div class="flex flex-wrap gap-2">
                @for (option of typeOptions; track option.type) {
                  <button
                    type="button"
                    (click)="setType(option.type)"
                    [attr.aria-pressed]="type === option.type"
                    class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all"
                    [class.text-white]="type === option.type"
                    [style.background-color]="type === option.type ? option.meta.colour : 'transparent'"
                    [style.border-color]="option.meta.colour"
                  >
                    <span aria-hidden="true">{{ option.meta.icon }}</span>
                    {{ option.meta.label }}
                  </button>
                }
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ typeHint() }}</p>
            </div>

            <div>
              <label for="project-description" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Description
              </label>
              <textarea
                id="project-description"
                name="description"
                [(ngModel)]="description"
                rows="3"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="project-status" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  id="project-status"
                  name="status"
                  [(ngModel)]="status"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label for="project-priority" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Priority
                </label>
                <select
                  id="project-priority"
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
                <label for="project-start" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Start date
                </label>
                <input
                  id="project-start"
                  name="startDate"
                  type="date"
                  [(ngModel)]="startDate"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              <div>
                <label for="project-due" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Due date
                </label>
                <input
                  id="project-due"
                  name="dueDate"
                  type="date"
                  [(ngModel)]="dueDate"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="project-icon" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Icon
                </label>
                <input
                  id="project-icon"
                  name="icon"
                  [(ngModel)]="icon"
                  maxlength="4"
                  placeholder="📋"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              <div>
                <label for="project-tags" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tags
                </label>
                <input
                  id="project-tags"
                  name="tags"
                  [(ngModel)]="tagText"
                  placeholder="work, home"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>

            <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                class="flex-1 rounded-lg bg-blue-500 py-2 font-medium text-white transition-colors hover:bg-blue-600"
              >
                {{ isNew() ? 'Create project' : 'Save changes' }}
              </button>
              <button
                type="button"
                (click)="cancel()"
                class="rounded-lg border border-slate-300 px-6 py-2 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `
})
export class ProjectEditComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectsService = inject(ProjectsService);
  private toast = inject(ToastService);

  private readonly projectId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly isNew = computed(() => !this.projectId());
  protected readonly project = computed(() => {
    this.projectsService.projects();
    return this.projectsService.getProject(this.projectId());
  });

  protected title = '';
  protected description = '';
  protected type: ProjectType = 'personal';
  protected status: Project['status'] = 'planning';
  protected priority: Project['priority'] = 'medium';
  protected startDate = '';
  protected dueDate = '';
  protected icon = '📋';
  protected tagText = '';

  protected readonly attempted = signal(false);
  private readonly typeSignal = signal<ProjectType>('personal');

  protected readonly typeOptions = PROJECT_TYPE_ORDER.map(type => ({
    type,
    meta: PROJECT_TYPES[type]
  }));

  protected readonly typeHint = computed(() => projectTypeMeta(this.typeSignal()).hint);

  protected setType(type: ProjectType): void {
    this.type = type;
    this.typeSignal.set(type);
    // Changing type re-suggests its icon, unless the user typed their own.
    const suggested = projectTypeMeta(type).icon;
    if (!this.icon || this.typeOptions.some(option => option.meta.icon === this.icon)) {
      this.icon = suggested;
    }
  }

  constructor() {
    const id = this.projectId();
    if (id && !this.project()) {
      this.projectsService.loadOne(id).subscribe();
    }

    effect(() => {
      const project = this.project();
      if (!project) return;
      this.title = project.title;
      this.description = project.description ?? '';
      this.type = project.type ?? 'personal';
      this.typeSignal.set(this.type);
      this.status = project.status;
      this.priority = project.priority;
      this.startDate = toDateOnly(project.startDate) ?? '';
      this.dueDate = toDateOnly(project.dueDate) ?? '';
      this.icon = project.icon ?? '📋';
      this.tagText = (project.tags ?? []).join(', ');
    });
  }

  protected save(): void {
    this.attempted.set(true);
    const title = this.title.trim();
    if (!title) return;

    const values = {
      title,
      description: this.description.trim() || undefined,
      type: this.type,
      status: this.status,
      priority: this.priority,
      // parseDateOnly, not new Date(string): a bare date string is UTC midnight.
      startDate: parseDateOnly(this.startDate),
      dueDate: parseDateOnly(this.dueDate),
      icon: this.icon || '📋',
      tags: this.tagText
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    };

    const existing = this.project();
    if (existing) {
      this.projectsService.updateProject(existing.id, values);
      this.toast.success('Project saved');
      this.router.navigate(['/projects', existing.id]);
      return;
    }

    const created = this.projectsService.createProject(values);
    this.toast.success('Project created');
    this.router.navigate(['/projects', created.id]);
  }

  protected cancel(): void {
    const existing = this.project();
    this.router.navigate(existing ? ['/projects', existing.id] : ['/projects']);
  }
}
