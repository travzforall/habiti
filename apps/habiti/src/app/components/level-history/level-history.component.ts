import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LevelService } from '../../services/level.service';
import { LEVEL_SOURCE_META } from '../../models/level.models';
import { LEVEL_BAND_META } from '../../utils/level-derivation.util';

const PAGE_SIZE = 25;

/**
 * "Why am I this level?" — the full, append-only record of everything the user
 * has earned.
 *
 * Uses the full-screen overlay pattern (nightly-planner) rather than the
 * anchored popover (status-avatar). The anchored one exists to un-clip a small
 * fixed-height menu and pays for it with scroll/resize listeners and flip math;
 * a scrollable list inside a scrollable page is a bad touch interaction, and
 * the overlay sidesteps the gradient card's stacking context entirely.
 */
@Component({
  selector: 'app-level-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        (click)="close()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-history-title"
      >
        <div
          class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div
            class="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          >
            <div>
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-bold">Level {{ level() }}</span>
                <span class="text-sm text-white/80">{{ bandIcon() }} {{ bandLabel() }}</span>
              </div>
              <p id="level-history-title" class="text-sm text-white/80 mt-0.5">
                @if (toNextBand(); as remaining) {
                  {{ remaining }} to {{ nextBandLabel() }}
                } @else {
                  Every level you have ever earned
                }
              </p>
            </div>
            <button
              type="button"
              class="text-white/80 hover:text-white text-xl leading-none p-1 -m-1"
              (click)="close()"
              aria-label="Close level history"
            >
              ✕
            </button>
          </div>

          <!-- Tamper warning: the ledger does not add up -->
          @if (chainBreaks().length > 0) {
            <div
              class="px-6 py-2 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
            >
              Some records don't add up. Your level is still the sum of what's below.
            </div>
          }

          <!-- Body -->
          <div class="overflow-y-auto flex-1 px-6 py-4">
            @if (sections().length === 0) {
              <div class="text-center py-10">
                <div class="text-5xl mb-3">🏔️</div>
                <p class="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Level 1. Nothing earned yet.
                </p>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Levels come from finishing challenges. Points come from habits — they're separate
                  now.
                </p>
                <button
                  type="button"
                  class="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                  (click)="browseChallenges()"
                >
                  Browse challenges
                </button>
              </div>
            } @else {
              @for (section of sections(); track section.monthLabel) {
                <div
                  class="sticky top-0 bg-white dark:bg-slate-800 py-1 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 z-10"
                >
                  {{ section.monthLabel }}
                </div>

                <div class="space-y-2 mb-4">
                  @for (record of section.records; track record.id) {
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                      <span
                        class="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0"
                        aria-hidden="true"
                        >{{ record.icon || sourceIcon(record.source) }}</span
                      >

                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {{ record.reason }}
                        </p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {{ record.occurredAt | date: 'MMM d, y' }}
                          @if (record.detail) {
                            · {{ record.detail }}
                          }
                        </p>
                      </div>

                      <div class="text-right flex-shrink-0">
                        <span
                          class="inline-block px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold"
                          >+{{ record.levelsAwarded }}</span
                        >
                        <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {{ record.levelBefore }} → {{ record.levelAfter }}
                        </p>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (hasMore()) {
                <button
                  type="button"
                  class="w-full py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  (click)="showMore()"
                >
                  Show earlier
                </button>
              }
            }
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 text-xs text-slate-500 dark:text-slate-400"
          >
            Levels are earned and permanent — they never go down. Points are separate and move with
            your habits.
          </div>
        </div>
      </div>
    }
  `
})
export class LevelHistoryComponent {
  private levelService = inject(LevelService);
  private router = inject(Router);

  protected readonly isOpen = signal(false);
  private readonly limit = signal(PAGE_SIZE);

  protected readonly level = this.levelService.level;
  protected readonly chainBreaks = this.levelService.chainBreaks;
  protected readonly toNextBand = this.levelService.toNextBand;

  protected readonly bandLabel = computed(() => LEVEL_BAND_META[this.levelService.band()].label);
  protected readonly bandIcon = computed(() => LEVEL_BAND_META[this.levelService.band()].icon);
  protected readonly nextBandLabel = computed(() => {
    const order = ['novice', 'steady', 'committed', 'relentless', 'legendary'] as const;
    const next = order[order.indexOf(this.levelService.band()) + 1];
    return next ? LEVEL_BAND_META[next].label : '';
  });

  /** Paged, then grouped — so a month header never appears with no rows under it. */
  protected readonly sections = computed(() => {
    const visible = this.levelService.records().slice(0, this.limit());
    return groupSections(visible);
  });

  protected readonly hasMore = computed(() => this.levelService.recordCount() > this.limit());

  open(): void {
    this.limit.set(PAGE_SIZE);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected showMore(): void {
    this.limit.update(n => n + PAGE_SIZE);
  }

  protected browseChallenges(): void {
    this.close();
    this.router.navigate(['/challenges']);
  }

  protected sourceIcon(source: keyof typeof LEVEL_SOURCE_META): string {
    return LEVEL_SOURCE_META[source].icon;
  }
}

// Kept out of the class so the computed above stays readable.
function groupSections<T extends { occurredAt: Date }>(rows: T[]) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const sections: { monthLabel: string; records: T[] }[] = [];

  for (const row of rows) {
    const label = `${months[row.occurredAt.getMonth()]} ${row.occurredAt.getFullYear()}`;
    const current = sections[sections.length - 1];
    if (current?.monthLabel === label) current.records.push(row);
    else sections.push({ monthLabel: label, records: [row] });
  }

  return sections;
}
