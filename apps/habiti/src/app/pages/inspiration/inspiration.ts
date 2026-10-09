import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InspirationService } from '../../services/inspiration.service';
import { ProjectsService } from '../../services/projects.service';
import { PERSONAL_BOARD } from '../../models/inspiration.models';
import { InspirationBoardComponent } from '../../components/inspiration-board/inspiration-board.component';

/**
 * The personal inspiration board, plus a way into each project's own.
 *
 * A page of its own rather than another panel on the dashboard: this is the
 * thing you open when motivation has run out, which is a different moment from
 * checking off today's habits.
 */
@Component({
  selector: 'app-inspiration',
  standalone: true,
  imports: [RouterModule, InspirationBoardComponent],
  template: `
    <div class="space-y-6">
      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">Inspiration</h1>
        <p class="text-slate-600 dark:text-slate-400">
          Videos, pictures and notes worth coming back to
        </p>
      </div>

      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <app-inspiration-board [board]="PERSONAL_BOARD" heading="Your board"></app-inspiration-board>
      </div>

      @if (projectsWithBoards().length > 0) {
        <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
          <h2 class="mb-1 font-semibold text-slate-800 dark:text-slate-100">Project boards</h2>
          <p class="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Each project keeps its own, on the project's page.
          </p>

          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (project of projectsWithBoards(); track project.id) {
              <li>
                <a
                  [routerLink]="['/projects', project.id]"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                >
                  <span class="text-2xl" aria-hidden="true">{{ project.icon || '📋' }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium text-slate-800 dark:text-slate-100">
                      {{ project.title || 'Untitled project' }}
                    </span>
                    <span class="text-xs text-slate-500">{{ project.count }} saved</span>
                  </span>
                </a>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `
})
export class InspirationComponent {
  private inspiration = inject(InspirationService);
  private projectsService = inject(ProjectsService);

  protected readonly PERSONAL_BOARD = PERSONAL_BOARD;

  /** Only projects that actually have something saved — an index, not a list of everything. */
  protected readonly projectsWithBoards = computed(() =>
    this.projectsService
      .projects()
      .map(project => ({
        id: project.id,
        title: project.title,
        icon: project.icon,
        count: this.inspiration.forBoard(project.id).length
      }))
      .filter(project => project.count > 0)
  );

  constructor() {
    this.inspiration.loadBoard(PERSONAL_BOARD);
  }
}
