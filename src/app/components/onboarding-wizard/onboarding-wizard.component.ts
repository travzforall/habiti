import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of, timeout } from 'rxjs';
import { HabitGuidanceComponent } from '../habit-guidance/habit-guidance.component';
import { HabitsService } from '../../services/habits';
import { AuthService } from '../../services/auth.service';
import { ChallengeService } from '../../services/challenge.service';
import { OnboardingService } from '../../services/onboarding.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { TourService } from '../../services/tour.service';
import { APP_TOUR_STEPS } from '../../config/app-tour.steps';
import { HABIT_TEMPLATE_PACKS, isAlreadyAdded } from '../../config/habit-template-packs';
import {
  LIBRARY_CATEGORIES,
  LibraryHabit,
  hasGuidance,
  searchLibrary,
  toHabitDraft
} from '../../config/habit-library';
import {
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DIFFICULTY_META,
  ChallengeDifficulty
} from '../../models/challenge.models';
import { ThemeChoice } from '../../models/onboarding.models';

/** Persisting the habits can hang on a flaky network; never trap the user. */
const PERSIST_TIMEOUT_MS = 8000;

/** Let the "you're set up" toast land before the spotlight covers the screen. */
const TOUR_HANDOFF_DELAY_MS = 500;

const THEME_OPTIONS: { id: ThemeChoice; label: string; icon: string; hint: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️', hint: 'Bright and high contrast' },
  { id: 'dark', label: 'Dark', icon: '🌙', hint: 'Easier on the eyes at night' },
  { id: 'auto', label: 'Auto', icon: '🔄', hint: 'Follows your device' }
];

/**
 * First-run setup.
 *
 * Mounted once in the app shell and renders nothing until OnboardingService
 * says this user needs it — see the note there about why an empty Baserow
 * result must never be mistaken for "never onboarded".
 *
 * Two doors on every screen. "Skip setup" writes the same defaults the app
 * already uses, so skipping changes nothing observable; it is a real terminal
 * state, not a deferral. Note that skipping SETUP does not decline the TOUR —
 * that is the checkbox on the last step, and someone who skipped is exactly the
 * person a walkthrough helps.
 */
@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, HabitGuidanceComponent],
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.scss'
})
export class OnboardingWizardComponent {
  private onboarding = inject(OnboardingService);
  private habitsService = inject(HabitsService);
  private challengeService = inject(ChallengeService);
  private themeService = inject(ThemeService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private tour = inject(TourService);

  // --- Visibility -----------------------------------------------------------

  /**
   * Also waits for the habit fetch: `mode()` is derived from habit count, and
   * an un-awaited empty list would show an established user the starter-habit
   * step.
   */
  protected readonly open = computed(
    () => this.onboarding.shouldOpen() && this.onboarding.modeSettled()
  );

  protected readonly mode = this.onboarding.mode;
  protected readonly isReturning = computed(() => this.mode() === 'returning');

  // --- Step machine ---------------------------------------------------------

  /**
   * Step ids rather than indices, because the starter-habit step disappears in
   * returning mode and index arithmetic around a hole is how off-by-ones start.
   */
  protected readonly steps = computed<string[]>(() =>
    this.isReturning()
      ? ['welcome', 'focus', 'preferences', 'done']
      : ['welcome', 'focus', 'habits', 'preferences', 'done']
  );

  private readonly stepIndex = signal(0);

  protected readonly step = computed(() => this.steps()[this.stepIndex()] ?? 'welcome');
  protected readonly stepNumber = computed(() => this.stepIndex() + 1);
  protected readonly stepCount = computed(() => this.steps().length);
  protected readonly isFirstStep = computed(() => this.stepIndex() === 0);
  protected readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);

  // --- Collected values -----------------------------------------------------

  protected readonly displayName = signal('');
  protected readonly focusAreas = signal<Set<string>>(new Set());
  protected readonly theme = signal<ThemeChoice>('auto');
  protected readonly difficulty = signal<ChallengeDifficulty>('medium');
  protected readonly launchGuide = signal(true);
  /** Chosen starter habits, keyed by library id. */
  protected readonly selected = signal<Map<string, LibraryHabit>>(new Map());

  protected readonly saving = signal(false);
  protected readonly guidanceFor = signal<LibraryHabit | null>(null);
  protected readonly habitTab = signal<'packs' | 'browse'>('packs');
  protected readonly search = signal('');
  protected readonly openPackId = signal<string | null>(null);

  // --- Static content -------------------------------------------------------

  protected readonly categories = LIBRARY_CATEGORIES;
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly difficulties = CHALLENGE_DIFFICULTIES;
  protected readonly difficultyMeta = CHALLENGE_DIFFICULTY_META;

  // --- Derived --------------------------------------------------------------

  protected readonly firstName = computed(() => {
    const name = this.auth.currentUserValue?.name?.trim();
    return name ? name.split(/\s+/)[0] : 'there';
  });

  /** Habit names the user already has, lower-cased — mirrors template-picker. */
  private readonly existingNames = computed(
    () => new Set(this.habitsService.habits().map(h => h.name.trim().toLowerCase()))
  );

  /** Packs narrowed to the chosen focus areas. No selection means show all. */
  protected readonly visiblePacks = computed(() => {
    const areas = this.focusAreas();
    if (areas.size === 0) return HABIT_TEMPLATE_PACKS;

    return HABIT_TEMPLATE_PACKS.filter(pack =>
      pack.habits.some(habit => areas.has(habit.categoryId))
    );
  });

  protected readonly searchResults = computed(() => {
    const term = this.search().trim();
    if (!term) return [];
    const areas = this.focusAreas();
    const hits = searchLibrary(term);
    return areas.size === 0 ? hits : hits.filter(h => areas.has(h.categoryId));
  });

  protected readonly selectedCount = computed(() => this.selected().size);

  /** A gentle nudge, never a block — see the note on the template. */
  protected readonly tooManySelected = computed(() => this.selectedCount() > 5);

  protected readonly summary = computed(() => {
    const count = this.selectedCount();
    const themeLabel = THEME_OPTIONS.find(o => o.id === this.theme())?.label ?? 'Auto';
    const parts = [
      count === 0 ? 'No starter habits' : `${count} habit${count === 1 ? '' : 's'}`,
      `${themeLabel.toLowerCase()} theme`,
      `${this.difficultyMeta[this.difficulty()].label.toLowerCase()} challenges`
    ];
    return parts.join(' · ');
  });

  constructor() {
    // Seed from anything already stored, so "Run setup again" from Settings
    // opens pre-filled rather than blank.
    effect(() => {
      if (!this.open()) return;
      this.hydrateOnce();
    });

    // Freeze the page behind the dialog — same reasoning as template-picker:
    // content sliding around under a fixed panel reads as broken.
    effect(() => {
      document.body.style.overflow = this.open() ? 'hidden' : '';
    });

    effect(() => {
      this.onboarding.setWizardOpen(this.open());
    });

    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  private hydrated = false;

  private hydrateOnce(): void {
    if (this.hydrated) return;
    this.hydrated = true;

    const prefs = this.onboarding.preferences();
    this.displayName.set(prefs.displayName ?? this.auth.currentUserValue?.name ?? '');
    this.focusAreas.set(new Set(prefs.focusAreas));
    this.theme.set(prefs.theme);
    this.difficulty.set(prefs.defaultDifficulty);
    // An established user did not ask to be shown around.
    this.launchGuide.set(!this.isReturning());
  }

  // --- Navigation -----------------------------------------------------------

  protected next(): void {
    if (this.isLastStep()) return;
    this.stepIndex.update(i => i + 1);
  }

  protected back(): void {
    if (this.isFirstStep()) return;
    this.stepIndex.update(i => i - 1);
  }

  /**
   * Esc skips rather than merely closing.
   *
   * A dialog that reopens on every navigation until it is answered is worse
   * than one that takes Esc as "leave me alone" and writes the defaults.
   */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.open() || this.saving()) return;
    this.skip();
  }

  // --- Step 2: focus areas --------------------------------------------------

  protected isFocused(id: string): boolean {
    return this.focusAreas().has(id);
  }

  protected toggleFocus(id: string): void {
    const next = new Set(this.focusAreas());
    next.has(id) ? next.delete(id) : next.add(id);
    this.focusAreas.set(next);
  }

  // --- Step 3: starter habits ----------------------------------------------

  protected togglePack(packId: string): void {
    this.openPackId.update(current => (current === packId ? null : packId));
  }

  protected isSelected(habit: LibraryHabit): boolean {
    return this.selected().has(habit.id);
  }

  protected alreadyAdded(habit: LibraryHabit): boolean {
    return this.existingNames().has(habit.name.trim().toLowerCase());
  }

  protected toggleHabit(habit: LibraryHabit): void {
    const next = new Map(this.selected());
    next.has(habit.id) ? next.delete(habit.id) : next.set(habit.id, habit);
    this.selected.set(next);
  }

  /** Add every habit in a pack that is not already on the user's list. */
  protected addWholePack(packId: string, event: Event): void {
    event.stopPropagation();
    const pack = HABIT_TEMPLATE_PACKS.find(p => p.id === packId);
    if (!pack) return;

    const next = new Map(this.selected());
    for (const habit of pack.habits) {
      if (!this.alreadyAdded(habit)) next.set(habit.id, habit);
    }
    this.selected.set(next);
  }

  protected clearSelection(): void {
    this.selected.set(new Map());
  }

  protected showsGuidance(habit: LibraryHabit): boolean {
    return hasGuidance(habit);
  }

  protected openGuidance(habit: LibraryHabit, event: Event): void {
    // The row is a <label>; without this the click also toggles the checkbox.
    event.preventDefault();
    event.stopPropagation();
    this.guidanceFor.set(habit);
  }

  // --- Step 4: preferences --------------------------------------------------

  /**
   * Applies immediately so the choice demonstrates itself, but does NOT
   * persist — the user may still hit Back or Skip.
   */
  protected chooseTheme(theme: ThemeChoice): void {
    this.theme.set(theme);
    this.themeService.preview(theme);
  }

  protected chooseDifficulty(difficulty: ChallengeDifficulty): void {
    this.difficulty.set(difficulty);
  }

  // --- Exits ----------------------------------------------------------------

  protected skip(): void {
    // Undo any live theme preview: skipping means "change nothing".
    this.themeService.revertPreview();
    this.onboarding.skip();
    this.reset();
    this.toast.info('Setup skipped', 'You can run it again any time from Settings.');
    this.startGuideIfWanted(true);
  }

  protected finish(): void {
    if (this.saving()) return;

    this.themeService.set(this.theme());
    this.challengeService.setDefaultDifficulty(this.difficulty());

    const chosen = [...this.selected().values()];
    // Re-checked at commit time, not just at selection: a sync may have added
    // one of these from another device while the wizard sat open.
    const existing = this.habitsService.habits();
    const fresh = chosen.filter(h => !isAlreadyAdded(h.name, existing));

    if (fresh.length === 0) {
      this.commit([]);
      return;
    }

    this.saving.set(true);

    /**
     * addHabits() emits only AFTER persistence, carrying the final Baserow row
     * ids. Waiting for it matters beyond correctness: the tour's "tick one off"
     * step needs a real habit card in the DOM to point at.
     */
    this.habitsService
      .addHabits(fresh.map(toHabitDraft))
      .pipe(
        timeout(PERSIST_TIMEOUT_MS),
        catchError(() => {
          // The habits are already in the local signal, so the UI is correct.
          // Holding the user behind a failed write is the worse outcome.
          this.toast.error('Saved locally', 'Your habits will sync when the connection returns.');
          return of([]);
        })
      )
      .subscribe(() => {
        this.saving.set(false);
        this.commit(fresh.map(h => h.id));
      });
  }

  private commit(starterHabits: string[]): void {
    const launchGuide = this.launchGuide();

    this.onboarding.complete({
      preferences: {
        displayName: this.displayName().trim() || undefined,
        focusAreas: [...this.focusAreas()],
        theme: this.theme(),
        defaultDifficulty: this.difficulty()
      },
      starterHabits,
      launchGuide
    });

    this.reset();

    this.toast.success(
      "You're all set",
      starterHabits.length
        ? `${starterHabits.length} habit${starterHabits.length === 1 ? '' : 's'} added.`
        : 'Add your first habit whenever you are ready.'
    );

    this.startGuideIfWanted(launchGuide);
  }

  private startGuideIfWanted(launch: boolean): void {
    if (!launch) return;
    setTimeout(() => this.tour.start(APP_TOUR_STEPS), TOUR_HANDOFF_DELAY_MS);
  }

  private reset(): void {
    this.stepIndex.set(0);
    this.selected.set(new Map());
    this.search.set('');
    this.openPackId.set(null);
    this.habitTab.set('packs');
    this.hydrated = false;
  }
}
