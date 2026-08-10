import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryHabit } from '../../config/habit-library';

/**
 * How to actually do a habit.
 *
 * Exists because "Deadlift" as a checkbox is close to useless — and worse than
 * useless if someone loads a bar without knowing what a flat back means. The
 * mistakes section is deliberately given equal weight to the steps: knowing
 * what people get wrong is usually more valuable than the instructions.
 *
 * No images are bundled. Exercise photography is licensed material, and
 * inventing URLs would ship broken images to every user. Where a habit supplies
 * a `searchQuery` we offer an honest link out instead, until real assets exist.
 */
@Component({
  selector: 'app-habit-guidance',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (habit(); as h) {
      <div
        class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'How to: ' + h.name"
      >
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="close.emit()"></div>

        <div
          class="relative w-full sm:max-w-xl max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div class="px-6 py-5 bg-gradient-to-r from-slate-700 to-slate-900 text-white shrink-0">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-3">
                  <span class="text-3xl">{{ h.icon }}</span>
                  <h2 class="text-xl font-bold truncate">{{ h.name }}</h2>
                </div>
                <p class="text-white/80 text-sm mt-1">{{ h.description }}</p>
              </div>
              <button
                (click)="close.emit()"
                aria-label="Close"
                class="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span class="px-2 py-1 rounded-full bg-white/15">{{ h.difficulty }}</span>
              <span class="px-2 py-1 rounded-full bg-white/15">⚡ {{ h.points }} pts</span>
              @if (h.unit) {
                <span class="px-2 py-1 rounded-full bg-white/15">
                  target {{ h.goal }} {{ h.unit }}
                </span>
              }
              @if (h.type === 'bad') {
                <span class="px-2 py-1 rounded-full bg-rose-500/80">habit to break</span>
              }
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            @if (h.guidance?.safety) {
              <!-- First, and visually loudest. Injuries outrank tidy layout. -->
              <div class="rounded-2xl bg-rose-50 border border-rose-200 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl">⚠️</span>
                  <div>
                    <div class="font-semibold text-rose-800 text-sm">Safety</div>
                    <p class="text-sm text-rose-700 mt-0.5">{{ h.guidance!.safety }}</p>
                  </div>
                </div>
              </div>
            }

            @if (h.guidance?.summary) {
              <p class="text-slate-700 leading-relaxed">{{ h.guidance!.summary }}</p>
            }

            @if (h.guidance?.equipment?.length || h.guidance?.muscles?.length) {
              <div class="grid sm:grid-cols-2 gap-3">
                @if (h.guidance?.equipment?.length) {
                  <div class="rounded-2xl bg-slate-50 p-4">
                    <div class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Equipment
                    </div>
                    <ul class="text-sm text-slate-700 space-y-1">
                      @for (item of h.guidance!.equipment; track item) {
                        <li>• {{ item }}</li>
                      }
                    </ul>
                  </div>
                }
                @if (h.guidance?.muscles?.length) {
                  <div class="rounded-2xl bg-slate-50 p-4">
                    <div class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Works
                    </div>
                    <ul class="text-sm text-slate-700 space-y-1">
                      @for (item of h.guidance!.muscles; track item) {
                        <li>• {{ item }}</li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }

            @if (h.guidance?.steps?.length) {
              <div>
                <h3 class="font-semibold text-slate-800 mb-2">How to do it</h3>
                <ol class="space-y-2">
                  @for (step of h.guidance!.steps; track step; let i = $index) {
                    <li class="flex gap-3 text-sm text-slate-700">
                      <span
                        class="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs"
                      >
                        {{ i + 1 }}
                      </span>
                      <span class="pt-0.5">{{ step }}</span>
                    </li>
                  }
                </ol>
              </div>
            }

            @if (h.guidance?.mistakes?.length) {
              <div>
                <h3 class="font-semibold text-slate-800 mb-2">Common mistakes</h3>
                <ul class="space-y-1.5">
                  @for (item of h.guidance!.mistakes; track item) {
                    <li class="flex gap-2 text-sm text-slate-700">
                      <span class="text-rose-500 shrink-0">✕</span>
                      <span>{{ item }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (h.guidance?.tips?.length) {
              <div>
                <h3 class="font-semibold text-slate-800 mb-2">Tips</h3>
                <ul class="space-y-1.5">
                  @for (item of h.guidance!.tips; track item) {
                    <li class="flex gap-2 text-sm text-slate-700">
                      <span class="text-emerald-500 shrink-0">✓</span>
                      <span>{{ item }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (h.guidance?.media?.imageUrl) {
              <img
                [src]="h.guidance!.media!.imageUrl"
                [alt]="'How to do ' + h.name"
                class="w-full rounded-2xl"
              />
            } @else if (h.guidance?.media?.searchQuery) {
              <!--
                No bundled photography, so we link out rather than show a broken
                image or a placeholder pretending to be a demonstration.
              -->
              <a
                [href]="'https://www.youtube.com/results?search_query=' + encode(h.guidance!.media!.searchQuery!)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 p-4 transition-colors"
              >
                <span class="text-2xl">🎥</span>
                <span class="min-w-0">
                  <span class="block font-medium text-slate-800 text-sm">Watch how it is done</span>
                  <span class="block text-xs text-slate-500 truncate">
                    Opens a search for "{{ h.guidance!.media!.searchQuery }}"
                  </span>
                </span>
              </a>
            }

            @if (h.tags?.length) {
              <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                @for (tag of h.tags; track tag) {
                  <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">
                    {{ tag }}
                  </span>
                }
              </div>
            }
          </div>

          <div class="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
            <button
              (click)="close.emit()"
              class="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-900 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class HabitGuidanceComponent {
  readonly habit = input<LibraryHabit | null>(null);
  readonly close = output<void>();

  protected encode(value: string): string {
    return encodeURIComponent(value);
  }
}
