import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Habit } from '../../services/habits';
import {
  TrackingSpec,
  describeTarget,
  formatTrackedValue,
  inputTypeFor,
  meetsTarget,
  minutesToTime,
  timeToMinutes,
  trackingPrompt
} from '../../config/habit-library';

/**
 * Records what a habit actually measures, not just that it happened.
 *
 * The control changes with the habit: a clock for "Wake at a set time", a
 * stepper for glasses of water, a weight field for the deadlift. Anything whose
 * tracking is `simple` never opens this at all — asking "how many?" about "No
 * junk food" is worse than a plain tick.
 */
@Component({
  selector: 'app-habit-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (habit(); as h) {
      <div
        class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Log ' + h.name"
      >
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="cancel.emit()"></div>

        <div class="relative w-full sm:max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ h.icon }}</span>
              <div class="min-w-0">
                <h2 class="font-bold text-slate-800 truncate">{{ h.name }}</h2>
                <p class="text-xs text-slate-500">{{ targetLabel() }}</p>
              </div>
            </div>
          </div>

          <div class="px-6 py-6">
            <label class="block text-sm font-medium text-slate-700 mb-3">{{ promptLabel() }}</label>

            @switch (control()) {
              @case ('time') {
                <input
                  type="time"
                  [value]="timeValue()"
                  (input)="setTime($any($event.target).value)"
                  class="w-full text-2xl font-bold text-center px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-400 outline-none"
                />
              }
              @case ('rating') {
                <div class="flex justify-center gap-2">
                  @for (score of ratingScale(); track score) {
                    <button
                      (click)="value.set(score)"
                      class="w-12 h-12 rounded-2xl font-bold transition-colors"
                      [class]="
                        value() === score
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      "
                    >
                      {{ score }}
                    </button>
                  }
                </div>
              }
              @case ('number') {
                <div class="flex items-center gap-3">
                  <button
                    (click)="step(-1)"
                    aria-label="Less"
                    class="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xl font-bold text-slate-600"
                  >
                    −
                  </button>
                  <div class="flex-1">
                    <input
                      type="number"
                      [value]="value() ?? ''"
                      (input)="setNumber($any($event.target).value)"
                      [min]="spec().min ?? 0"
                      [step]="spec().step ?? 1"
                      class="w-full text-2xl font-bold text-center px-2 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-400 outline-none"
                    />
                    @if (spec().unit) {
                      <p class="text-center text-xs text-slate-400 mt-1">{{ spec().unit }}</p>
                    }
                  </div>
                  <button
                    (click)="step(1)"
                    aria-label="More"
                    class="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xl font-bold text-slate-600"
                  >
                    +
                  </button>
                </div>
              }
            }

            @if (control() !== 'none' && value() !== undefined) {
              <p
                class="text-center text-sm mt-4 font-medium"
                [class]="hits() ? 'text-emerald-600' : 'text-amber-600'"
              >
                {{ hits() ? '✓ Target met' : 'Logged — short of target' }}
              </p>
            }
          </div>

          <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              (click)="cancel.emit()"
              class="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <div class="flex items-center gap-2">
              <!--
                Logging without a number still counts. Refusing the check-in
                because someone cannot remember the exact figure is how habit
                trackers get abandoned.
              -->
              <button
                (click)="save(undefined)"
                class="px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium"
              >
                Skip the number
              </button>
              <button
                (click)="save(value())"
                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-md hover:shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class HabitLogComponent {
  readonly habit = input<Habit | null>(null);
  readonly spec = input.required<TrackingSpec>();
  /** Value already recorded today, if any. */
  readonly current = input<number | undefined>(undefined);

  readonly logged = output<number | undefined>();
  readonly cancel = output<void>();

  protected readonly value = signal<number | undefined>(undefined);

  constructor() {
    // Seed with today's value if there is one, otherwise the target — most
    // people hit their target most days, so it is the fastest default.
    effect(() => {
      if (!this.habit()) return;
      this.value.set(this.current() ?? this.spec().target);
    });
  }

  protected readonly control = computed(() => inputTypeFor(this.spec()));
  protected readonly promptLabel = computed(() =>
    trackingPrompt(this.spec(), this.habit()?.name ?? '')
  );
  protected readonly targetLabel = computed(() => describeTarget(this.spec()));
  protected readonly hits = computed(() => meetsTarget(this.spec(), this.value()));

  protected readonly timeValue = computed(() => minutesToTime(this.value() ?? 0));

  protected readonly ratingScale = computed(() => {
    const max = this.spec().max ?? 5;
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  protected setTime(hhmm: string): void {
    this.value.set(timeToMinutes(hhmm));
  }

  protected setNumber(raw: string): void {
    const parsed = Number(raw);
    this.value.set(raw === '' || !Number.isFinite(parsed) ? undefined : parsed);
  }

  protected step(direction: number): void {
    const spec = this.spec();
    const size = spec.step ?? 1;
    const next = (this.value() ?? 0) + direction * size;
    const min = spec.min ?? 0;
    this.value.set(Math.max(min, spec.max !== undefined ? Math.min(spec.max, next) : next));
  }

  protected save(value: number | undefined): void {
    this.logged.emit(value);
  }

  /** Exposed for the caller's summary line. */
  format(value: number | undefined): string {
    return formatTrackedValue(this.spec(), value);
  }
}
