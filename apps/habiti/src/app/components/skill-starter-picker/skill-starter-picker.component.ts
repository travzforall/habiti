import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { SkillDefinition } from '../../config/skill-catalogue';
import { ProjectsService } from '../../services/projects.service';
import { TasksService } from '../../services/tasks.service';
import { ToastService } from '../../services/toast.service';

export interface StarterSelection {
  taskRefs: { key: string; taskId: string }[];
  projectRefs: { key: string; projectId: string }[];
}

/**
 * The starter work a skill suggests: a few tasks and a project.
 *
 * Opt-in, never automatic. Silently creating a project and five tasks the
 * moment someone starts a skill dumps work into lists they did not ask for,
 * and unpicking it is tedious enough that people abandon the feature instead.
 *
 * Opens on top of the skill dialog, so z-[130] — the dialog-from-dialog rung in
 * src/app/config/z-layers.ts.
 */
@Component({
  selector: 'app-skill-starter-picker',
  standalone: true,
  template: `
    @if (skill(); as definition) {
      <div
        class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="definition.name + ' starter work'"
      >
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="skip()"></div>

        <div
          class="relative w-full sm:max-w-lg max-h-[85vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div class="px-6 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shrink-0">
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ definition.icon }}</span>
              <div class="min-w-0">
                <h2 class="text-lg font-bold truncate">First steps</h2>
                <p class="text-sm text-white/85">
                  The work that gets {{ definition.name }} moving. All optional.
                </p>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            @if (definition.starterTasks.length) {
              <div>
                <h3 class="text-xs uppercase tracking-wide text-slate-400 mb-2">Tasks</h3>
                <div class="space-y-2">
                  @for (starter of definition.starterTasks; track starter.key) {
                    <label
                      class="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors"
                      [class]="
                        chosenTasks().has(starter.key)
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      "
                    >
                      <input
                        type="checkbox"
                        class="mt-1 w-5 h-5 rounded accent-blue-600 shrink-0"
                        [checked]="chosenTasks().has(starter.key)"
                        (change)="toggleTask(starter.key)"
                      />
                      <span class="min-w-0">
                        <span class="block font-medium text-slate-800 dark:text-slate-100">
                          {{ starter.title }}
                        </span>
                        <span class="block text-sm text-slate-500 dark:text-slate-400">
                          {{ starter.description }}
                        </span>
                      </span>
                    </label>
                  }
                </div>
              </div>
            }

            @if (definition.starterProjects.length) {
              <div>
                <h3 class="text-xs uppercase tracking-wide text-slate-400 mb-2">Projects</h3>
                <div class="space-y-2">
                  @for (starter of definition.starterProjects; track starter.key) {
                    <label
                      class="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors"
                      [class]="
                        chosenProjects().has(starter.key)
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      "
                    >
                      <input
                        type="checkbox"
                        class="mt-1 w-5 h-5 rounded accent-blue-600 shrink-0"
                        [checked]="chosenProjects().has(starter.key)"
                        (change)="toggleProject(starter.key)"
                      />
                      <span class="min-w-0">
                        <span class="block font-medium text-slate-800 dark:text-slate-100">
                          {{ starter.title }}
                        </span>
                        <span class="block text-sm text-slate-500 dark:text-slate-400">
                          {{ starter.description }}
                        </span>
                        <span class="block text-xs text-slate-400 mt-1">
                          {{ starter.taskTitles.length }} steps
                        </span>
                      </span>
                    </label>
                  }
                </div>
              </div>
            }
          </div>

          <div
            class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 shrink-0"
          >
            <button
              (click)="skip()"
              class="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
            >
              Not now
            </button>
            <button
              (click)="apply()"
              [disabled]="total() === 0"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {{ total() === 0 ? 'Nothing selected' : 'Add ' + total() + ' item' + (total() === 1 ? '' : 's') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SkillStarterPickerComponent {
  private tasks = inject(TasksService);
  private projects = inject(ProjectsService);
  private toast = inject(ToastService);

  /** Null closes the dialog — the parent owns "which skill, if any". */
  readonly skill = input<SkillDefinition | null>(null);

  readonly close = output<void>();
  readonly applied = output<StarterSelection>();

  protected readonly chosenTasks = signal(new Set<string>());
  protected readonly chosenProjects = signal(new Set<string>());

  protected readonly total = computed(() => this.chosenTasks().size + this.chosenProjects().size);

  constructor() {
    // Everything pre-checked: these are the recommendations, and someone who
    // opened the dialog has already opted in once.
    effect(() => {
      const definition = this.skill();
      if (!definition) return;
      this.chosenTasks.set(new Set(definition.starterTasks.map(t => t.key)));
      this.chosenProjects.set(new Set(definition.starterProjects.map(p => p.key)));
      document.body.style.overflow = 'hidden';
    });

    // Closing by navigation must not leave the page permanently unscrollable.
    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  protected toggleTask(key: string): void {
    this.chosenTasks.update(current => toggle(current, key));
  }

  protected toggleProject(key: string): void {
    this.chosenProjects.update(current => toggle(current, key));
  }

  protected skip(): void {
    document.body.style.overflow = '';
    this.close.emit();
  }

  protected apply(): void {
    const definition = this.skill();
    if (!definition) return;

    const taskRefs = definition.starterTasks
      .filter(starter => this.chosenTasks().has(starter.key))
      .map(starter => ({
        key: starter.key,
        taskId: this.tasks.createTask({
          title: starter.title,
          description: starter.description,
          priority: starter.priority
        }).id
      }));

    const projectRefs = definition.starterProjects
      .filter(starter => this.chosenProjects().has(starter.key))
      .map(starter => {
        const project = this.projects.createProject({
          title: starter.title,
          description: starter.description,
          icon: definition.icon,
          status: 'planning'
        });

        // The steps become tasks on the project, so it opens with a plan
        // rather than an empty shell.
        for (const title of starter.taskTitles) {
          this.projects.createTask(project.id, { title });
        }
        return { key: starter.key, projectId: project.id };
      });

    this.toast.success(
      'Added to your lists',
      `${taskRefs.length} task${taskRefs.length === 1 ? '' : 's'}` +
        (projectRefs.length ? ` and ${projectRefs.length} project${projectRefs.length === 1 ? '' : 's'}` : '')
    );

    document.body.style.overflow = '';
    this.applied.emit({ taskRefs, projectRefs });
    this.close.emit();
  }
}

function toggle(current: Set<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
