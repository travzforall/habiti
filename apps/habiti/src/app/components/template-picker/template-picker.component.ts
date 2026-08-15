import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitGuidanceComponent } from '../habit-guidance/habit-guidance.component';
import { Habit, HabitsService } from '../../services/habits';
import { ToastService } from '../../services/toast.service';
import { HabitTemplatePack, isAlreadyAdded } from '../../config/habit-template-packs';
import { LibraryHabit, hasGuidance, toHabitDraft } from '../../config/habit-library';
import { sensitiveCategoriesIn } from '../../config/sensitive-habits';
import { SensitiveCategory } from '../../models/consent.models';
import { ConsentService } from '../../services/consent.service';
import { SensitiveConsentComponent } from '../sensitive-consent/sensitive-consent.component';

/**
 * Pick which habits from a pack to add.
 *
 * A pack is a suggestion, not an all-or-nothing bundle — most people want four
 * of the six. Habits already on the user's list are shown, pre-deselected and
 * labelled, rather than hidden: hiding them makes the pack look wrong ("where
 * are the other two?") and inviting a duplicate is worse.
 */
@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [CommonModule, HabitGuidanceComponent, SensitiveConsentComponent],
  template: `
    <!--
      The Article 9 consent dialog, on top of this one.

      Rendered as a SIBLING rather than nested inside the picker's backdrop:
      backdrop-filter makes an element a containing block for position: fixed
      descendants, so nesting it would position it against the picker card and
      scroll it with the list. Same reason root.html keeps the glass panel
      beside the router outlet rather than around it.
    -->
    <app-sensitive-consent
      [categories]="consentNeeded()"
      (accepted)="onConsentAccepted($event)"
      (declined)="onConsentDeclined()"
    />

    @if (pack(); as p) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="p.name + ' template'"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="close.emit()"></div>

        <div
          class="relative w-full sm:max-w-2xl max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          <!-- Header -->
          <div class="bg-gradient-to-r {{ p.accent }} px-6 py-5 text-white shrink-0">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-3">
                  <span class="text-3xl">{{ p.icon }}</span>
                  <h2 class="text-xl font-bold truncate">{{ p.name }}</h2>
                </div>
                <p class="text-white/90 text-sm mt-1">{{ p.description }}</p>
              </div>
              <button
                (click)="close.emit()"
                aria-label="Close"
                class="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Select all / none -->
          <div
            class="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0"
          >
            <span class="text-sm text-slate-600">
              {{ selectedCount() }} of {{ selectableCount() }} selected
            </span>
            <div class="flex items-center gap-2">
              <button
                (click)="selectAll()"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Select all
              </button>
              <button
                (click)="selectNone()"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Habits -->
          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            @for (habit of p.habits; track habit.name) {
              @let already = existingNames().has(habit.name.trim().toLowerCase());
              <label
                class="flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer"
                [class.border-blue-300]="isSelected(habit.name)"
                [class.bg-blue-50]="isSelected(habit.name)"
                [class.border-slate-200]="!isSelected(habit.name)"
                [class.opacity-60]="already"
              >
                <input
                  type="checkbox"
                  class="mt-1 w-5 h-5 rounded accent-blue-600 shrink-0"
                  [checked]="isSelected(habit.name)"
                  (change)="toggle(habit.name)"
                />
                <span class="text-2xl leading-none shrink-0">{{ habit.icon }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-slate-800">{{ habit.name }}</span>
                    @if (already) {
                      <span
                        class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wide"
                      >
                        Already added
                      </span>
                    }
                    @if (habit.type === 'bad') {
                      <span
                        class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wide"
                      >
                        Break
                      </span>
                    }
                  </span>
                  <span class="block text-sm text-slate-500 mt-0.5">{{ habit.description }}</span>
                  <span class="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{{ habit.difficulty }}</span>
                    <span>⚡ {{ habit.points }} pts</span>
                    @if (habit.unit) {
                      <span>{{ habit.goal }} {{ habit.unit }}</span>
                    }
                    @if (showsGuidance(habit)) {
                      <button
                        type="button"
                        (click)="openGuidance(habit, $event)"
                        class="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        How to do it
                      </button>
                    }
                  </span>
                </span>
              </label>
            }
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              (click)="close.emit()"
              class="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              (click)="apply()"
              [disabled]="selectedCount() === 0"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {{ selectedCount() === 0 ? 'Select some habits' : 'Add ' + selectedCount() + ' habit' + (selectedCount() === 1 ? '' : 's') }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-habit-guidance
      [habit]="guidanceFor()"
      (close)="guidanceFor.set(null)"
    ></app-habit-guidance>
  `
})
export class TemplatePickerComponent {
  private habitsService = inject(HabitsService);
  private toast = inject(ToastService);
  private consent = inject(ConsentService);

  /**
   * Article 9 consent state, held while the dialog is open.
   *
   * The chosen habits are parked rather than added, so that agreeing adds
   * exactly the set the user picked — re-deriving it after the modal closes
   * would risk adding a different set than the one they were shown.
   */
  protected readonly consentNeeded = signal<SensitiveCategory[]>([]);
  private readonly pendingHabits = signal<LibraryHabit[]>([]);
  private readonly pendingSkipped = signal(0);
  private readonly pendingPackName = signal('');

  constructor() {
    /**
     * Freeze the page behind the dialog.
     *
     * Even correctly anchored to the viewport, a modal you can scroll the page
     * behind feels broken — content slides around underneath while the dialog
     * sits still.
     */
    effect(() => {
      document.body.style.overflow = this.pack() ? 'hidden' : '';
    });

    // Closing by navigation rather than by the buttons must not leave the page
    // permanently unscrollable.
    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  /** Null closes the dialog — the parent owns "which pack, if any". */
  readonly pack = input<HabitTemplatePack | null>(null);

  readonly close = output<void>();
  /** The habits actually created, with their FINAL ids — safe to bind against. */
  readonly added = output<Habit[]>();

  /** Names the user already has, lower-cased for comparison. */
  protected readonly existingNames = computed(
    () => new Set(this.habitsService.habits().map(h => h.name.trim().toLowerCase()))
  );

  /**
   * Explicit selections. Null means "not decided yet", which is what makes the
   * default (everything except duplicates) work without writing the whole set
   * out on open.
   */
  private readonly overrides = signal<Map<string, boolean> | null>(null);

  private defaultSelected(name: string): boolean {
    return !this.existingNames().has(name.trim().toLowerCase());
  }

  protected isSelected(name: string): boolean {
    const explicit = this.overrides()?.get(name);
    return explicit ?? this.defaultSelected(name);
  }

  protected readonly selectedCount = computed(
    () => (this.pack()?.habits ?? []).filter(h => this.isSelected(h.name)).length
  );

  protected readonly selectableCount = computed(() => this.pack()?.habits.length ?? 0);

  protected toggle(name: string): void {
    const next = new Map(this.overrides() ?? []);
    next.set(name, !this.isSelected(name));
    this.overrides.set(next);
  }

  protected selectAll(): void {
    this.setAll(true);
  }

  protected selectNone(): void {
    this.setAll(false);
  }

  private setAll(value: boolean): void {
    const next = new Map<string, boolean>();
    for (const habit of this.pack()?.habits ?? []) next.set(habit.name, value);
    this.overrides.set(next);
  }

  /** Whether to offer a "How to do it" link for this habit. */
  protected showsGuidance(habit: LibraryHabit): boolean {
    return hasGuidance(habit);
  }

  protected openGuidance(habit: LibraryHabit, event: Event): void {
    // The row is a <label>; without this the click also toggles the checkbox.
    event.preventDefault();
    event.stopPropagation();
    this.guidanceFor.set(habit);
  }

  protected readonly guidanceFor = signal<LibraryHabit | null>(null);

  protected apply(): void {
    const pack = this.pack();
    if (!pack) return;

    const chosen = pack.habits.filter(h => this.isSelected(h.name));
    if (chosen.length === 0) return;

    // Re-checked at apply time, not just at open: a sync may have added one of
    // these from another device while the dialog sat open.
    const existing = this.habitsService.habits();
    const fresh = chosen.filter(h => !isAlreadyAdded(h.name, existing));
    const skipped = chosen.length - fresh.length;

    if (fresh.length === 0) {
      this.toast.info('Nothing to add', 'You already have all of those.');
      this.reset();
      this.close.emit();
      return;
    }

    /**
     * Article 9 gate.
     *
     * Only the categories NOT already consented to are asked about — someone
     * who agreed to recovery tracking last week is not asked again, which is
     * the difference between a considered prompt and a nag.
     */
    const needed = sensitiveCategoriesIn(fresh).filter(c => !this.consent.hasSensitiveConsent(c));
    if (needed.length > 0) {
      this.pendingHabits.set(fresh);
      this.pendingSkipped.set(skipped);
      this.pendingPackName.set(pack.name);
      this.consentNeeded.set(needed);
      return;
    }

    this.commit(fresh, skipped, pack.name);
  }

  /** Consent given: record it, then add exactly what was on the table. */
  protected onConsentAccepted(categories: SensitiveCategory[]): void {
    for (const category of categories) {
      this.consent.recordSensitiveConsent(category, true, 'habit_add');
    }
    this.consentNeeded.set([]);
    this.commit(this.pendingHabits(), this.pendingSkipped(), this.pendingPackName());
  }

  /**
   * Declined. Nothing is added — not even the non-sensitive habits in the pack.
   *
   * Quietly adding "the rest" would be a worse answer than it looks: the user
   * asked for a set, and silently delivering a different one teaches them their
   * choices are being second-guessed. The refusal is recorded, which is also
   * what shows the path was real.
   */
  protected onConsentDeclined(): void {
    for (const category of this.consentNeeded()) {
      this.consent.recordSensitiveConsent(category, false, 'habit_add');
    }
    this.consentNeeded.set([]);
    this.pendingHabits.set([]);
    this.toast.info('Nothing added', 'You can add habits that do not need that at any time.');
    this.reset();
    this.close.emit();
  }

  private commit(fresh: LibraryHabit[], skipped: number, packName: string): void {
    if (fresh.length === 0) return;

    this.habitsService.addHabits(fresh.map(toHabitDraft)).subscribe(created => this.added.emit(created));

    this.toast.success(
      `Added ${fresh.length} habit${fresh.length === 1 ? '' : 's'}`,
      skipped > 0 ? `${skipped} you already had ${skipped === 1 ? 'was' : 'were'} skipped.` : packName
    );

    this.reset();
    this.close.emit();
  }

  /** So reopening a pack starts from the defaults rather than last time's picks. */
  private reset(): void {
    this.overrides.set(null);
  }
}
