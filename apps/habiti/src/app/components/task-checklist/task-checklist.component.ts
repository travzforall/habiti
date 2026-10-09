import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistService } from '../../services/checklist.service';
import { checklistProgress } from '../../config/task-progress';

/**
 * A task's steps.
 *
 * Ticking is optimistic and per-item — each row is written on its own, which is
 * the point of the checklist being rows rather than a blob (see
 * ChecklistService). This is also what a task's progress bar is made of when
 * there is a checklist at all; see config/task-progress.ts.
 */
@Component({
  selector: 'app-task-checklist',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100">Checklist</h3>
        @if (items().length > 0) {
          <span class="text-sm text-slate-500">
            {{ doneCount() }} of {{ items().length }} · {{ progress() }}%
          </span>
        }
      </div>

      @if (items().length > 0) {
        <div class="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            [style.width.%]="progress()"
          ></div>
        </div>
      }

      <ul class="space-y-1">
        @for (item of items(); track item.id) {
          <li
            class="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40"
          >
            <input
              type="checkbox"
              [checked]="item.completed"
              (change)="checklist.toggle(item.id)"
              [attr.aria-label]="item.title"
              class="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
            />
            <span
              class="flex-1 text-sm text-slate-700 dark:text-slate-200"
              [class.line-through]="item.completed"
              [class.text-slate-400]="item.completed"
            >
              {{ item.title }}
            </span>
            <button
              type="button"
              (click)="checklist.remove(item.id)"
              [attr.aria-label]="'Remove ' + item.title"
              class="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        }
      </ul>

      <form (ngSubmit)="add()" class="mt-2 flex gap-2">
        <input
          name="newItem"
          [(ngModel)]="draft"
          placeholder="Add a step…"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <button
          type="submit"
          class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
        >
          Add
        </button>
      </form>
    </section>
  `
})
export class TaskChecklistComponent {
  readonly taskId = input.required<string>();

  protected readonly checklist = inject(ChecklistService);
  protected draft = '';

  protected readonly items = computed(() => this.checklist.forTask(this.taskId()));
  protected readonly doneCount = computed(() => this.items().filter(i => i.completed).length);
  protected readonly progress = computed(() => checklistProgress(this.items()));

  protected add(): void {
    const added = this.checklist.add(this.taskId(), this.draft);
    if (added) this.draft = '';
  }
}
