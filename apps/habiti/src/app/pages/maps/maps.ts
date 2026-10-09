import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MindMapService } from '../../services/mind-map.service';
import { ProjectsService } from '../../services/projects.service';
import { MindMap, PERSONAL_BOARD } from '../../models/mind-map.models';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

/**
 * Every map this account has, personal ones first.
 *
 * Creating one from here drops straight into the editor with the root topic
 * selected — an empty map with a "start" button in the middle would be one more
 * click before the first idea.
 */
@Component({
  selector: 'app-maps',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">Mind maps</h1>
            <p class="text-slate-600 dark:text-slate-400">
              Think it through, then turn the branches into tasks
            </p>
          </div>

          <form (ngSubmit)="create()" class="flex gap-2">
            <input
              name="title"
              [(ngModel)]="draftTitle"
              placeholder="New map"
              class="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <select
              name="board"
              [(ngModel)]="draftBoard"
              aria-label="Where the map belongs"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option [value]="PERSONAL_BOARD">Personal</option>
              @for (project of projects(); track project.id) {
                <option [value]="project.id">{{ project.title || 'Untitled project' }}</option>
              }
            </select>
            <button
              type="submit"
              class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Create
            </button>
          </form>
        </div>
      </div>

      @for (group of groups(); track group.board) {
        <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
          <h2 class="mb-4 font-semibold text-slate-800 dark:text-slate-100">
            {{ group.label }}
            <span class="ml-1 text-sm font-normal text-slate-500">({{ group.maps.length }})</span>
          </h2>

          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (map of group.maps; track map.id) {
              <li class="group relative rounded-xl border border-slate-200 p-4 transition-shadow hover:shadow-md dark:border-slate-700">
                <a [routerLink]="['/maps', map.id]" class="block">
                  <span class="mb-1 block truncate font-medium text-slate-800 dark:text-slate-100">
                    🧠 {{ map.title }}
                  </span>
                  <span class="block text-xs text-slate-500">
                    {{ map.nodeCount }} topic{{ map.nodeCount === 1 ? '' : 's' }} · edited
                    {{ map.updatedAt | date: 'MMM d' }}
                  </span>
                </a>
                <button
                  (click)="pendingDelete.set(map)"
                  [attr.aria-label]="'Delete ' + map.title"
                  class="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            }
          </ul>
        </div>
      } @empty {
        <div class="rounded-xl bg-white p-12 text-center shadow-lg dark:bg-slate-800">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
            <span class="text-2xl">🧠</span>
          </div>
          <h2 class="mb-2 text-xl font-bold text-slate-800 dark:text-slate-100">No maps yet</h2>
          <p class="mb-6 text-slate-600 dark:text-slate-400">
            Start one for a project you are stuck on, or for an idea that has not become a plan yet.
          </p>
          <button
            (click)="create()"
            class="rounded-lg bg-blue-500 px-6 py-3 text-white hover:bg-blue-600"
          >
            Create your first map
          </button>
        </div>
      }
    </div>

    <app-confirm-dialog
      [open]="!!pendingDelete()"
      title="Delete this map?"
      [message]="
        '“' + (pendingDelete()?.title ?? '') + '” and all of its topics will be removed. Tasks made from it are kept.'
      "
      confirmLabel="Delete"
      (confirmed)="deleteConfirmed()"
      (cancelled)="pendingDelete.set(null)"
    ></app-confirm-dialog>
  `
})
export class MapsComponent {
  private maps = inject(MindMapService);
  private projectsService = inject(ProjectsService);
  private router = inject(Router);

  protected readonly PERSONAL_BOARD = PERSONAL_BOARD;
  protected readonly projects = this.projectsService.projects;
  protected readonly pendingDelete = signal<MindMap | null>(null);

  protected draftTitle = '';
  protected draftBoard = PERSONAL_BOARD;

  /** Personal first, then a group per project that actually has maps. */
  protected readonly groups = computed(() => {
    const personal = this.maps.mapsForBoard(PERSONAL_BOARD);
    const groups = personal.length
      ? [{ board: PERSONAL_BOARD, label: 'Personal', maps: personal }]
      : [];

    for (const project of this.projects()) {
      const forProject = this.maps.mapsForBoard(project.id);
      if (forProject.length) {
        groups.push({
          board: project.id,
          label: `${project.icon ?? '📋'} ${project.title || 'Untitled project'}`,
          maps: forProject
        });
      }
    }
    return groups;
  });

  constructor() {
    this.maps.loadMaps();
  }

  protected create(): void {
    const map = this.maps.createMap(this.draftBoard, this.draftTitle || 'New map');
    this.draftTitle = '';
    this.router.navigate(['/maps', map.id]);
  }

  protected deleteConfirmed(): void {
    const map = this.pendingDelete();
    this.pendingDelete.set(null);
    if (map) this.maps.deleteMap(map.id);
  }
}
