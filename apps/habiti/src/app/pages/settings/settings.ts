import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LegalLinksComponent } from '../../components/legal-links/legal-links.component';
import { HabitsService } from '../../services/habits';
import { ConsentService } from '../../services/consent.service';
import { ToastService } from '../../services/toast.service';
import { SENSITIVE_CATEGORY_COPY, sensitiveCategoryOf } from '../../config/sensitive-habits';
import { libraryHabitByName } from '../../config/habit-library';
import { SensitiveCategory } from '../../models/consent.models';
import { HabitImporterService } from '../../services/habit-importer.service';
import { ChallengeService } from '../../services/challenge.service';
import { OnboardingService } from '../../services/onboarding.service';
import { TourService } from '../../services/tour.service';
import { APP_TOUR_STEPS } from '../../config/app-tour.steps';
import {
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DIFFICULTY_META,
  ChallengeDifficulty
} from '../../models/challenge.models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, LegalLinksComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private habitsService = inject(HabitsService);
  private importerService = inject(HabitImporterService);
  private challengeService = inject(ChallengeService);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;

  /** Computed, so the About card cannot go stale the way the hardcoded 2024 did. */
  protected readonly currentYear = new Date().getFullYear();

  private consent = inject(ConsentService);
  private toast = inject(ToastService);

  /** Live Article 9 consents — withdrawn ones drop out of this list. */
  protected readonly sensitiveConsents = this.consent.sensitiveConsents;

  protected consentLabel(scope: string | undefined): string {
    const copy = SENSITIVE_CATEGORY_COPY[scope as SensitiveCategory];
    return copy ? `${copy.icon} ${copy.label}` : (scope ?? 'Unknown');
  }

  /**
   * The habits a withdrawal would affect, offered for deletion afterwards.
   *
   * Held here rather than deleted immediately, because deletion is OFFERED and
   * not forced: someone may want Habiti to stop treating the data as consented
   * while keeping their own history, and quietly destroying months of recovery
   * tracking because they clicked "withdraw" would be its own kind of harm.
   */
  protected readonly withdrawnCategory = signal<SensitiveCategory | null>(null);

  protected readonly affectedHabits = computed(() => {
    const category = this.withdrawnCategory();
    if (!category) return [];
    return this.habits().filter(habit => {
      const entry = habit.name ? libraryHabitByName(habit.name) : undefined;
      return !!entry && sensitiveCategoryOf(entry) === category;
    });
  });

  /**
   * Withdraws a consent.
   *
   * A consent you can withdraw while the data stays put is not much of a
   * consent, so this is immediately followed by the offer to delete what it
   * covered — see affectedHabits().
   */
  protected withdrawConsent(scope: string | undefined): void {
    if (!scope) return;
    const category = scope as SensitiveCategory;
    this.consent.withdraw('special_category', category);
    this.withdrawnCategory.set(category);

    const label = SENSITIVE_CATEGORY_COPY[category]?.label ?? scope;
    this.toast.success('Consent withdrawn', `Habiti will not store new ${label.toLowerCase()} habits.`);
  }

  /** Deletes the habits the withdrawn consent covered. */
  protected deleteAffectedHabits(): void {
    const affected = this.affectedHabits();
    for (const habit of affected) this.habitsService.deleteHabit(habit.id);
    this.withdrawnCategory.set(null);
    this.toast.success(
      `Deleted ${affected.length} habit${affected.length === 1 ? '' : 's'}`,
      'And everything recorded against them.'
    );
  }

  protected keepAffectedHabits(): void {
    this.withdrawnCategory.set(null);
  }

  // Challenge difficulty: the global default, overridable per challenge.
  protected readonly difficulties = CHALLENGE_DIFFICULTIES;
  protected readonly difficultyMeta = CHALLENGE_DIFFICULTY_META;
  protected readonly defaultDifficulty = this.challengeService.defaultDifficulty;

  protected setDifficulty(difficulty: ChallengeDifficulty): void {
    this.challengeService.setDefaultDifficulty(difficulty);
  }

  // --- Getting started ------------------------------------------------------
  //
  // Note: most of the controls on this page are still unbound static markup
  // (the theme select and the notification checkboxes do nothing). These three
  // are genuinely wired — do not copy the dead ones around them.

  private onboarding = inject(OnboardingService);
  private tour = inject(TourService);

  protected readonly guideStatus = this.onboarding.guideStatus;

  /** 1-based, for the "Resume at step N" label. */
  protected readonly guideResumeStep = computed(() => this.onboarding.guideStepIndex() + 1);
  protected readonly guideTotalSteps = APP_TOUR_STEPS.filter(
    s => !s.media || window.matchMedia(s.media).matches
  ).length;

  protected readonly canResumeGuide = computed(
    () => this.guideStatus() === 'in_progress' && this.onboarding.guideStepIndex() > 0
  );

  protected replayGuide(): void {
    this.tour.start(APP_TOUR_STEPS, 0);
  }

  protected resumeGuide(): void {
    this.tour.start(APP_TOUR_STEPS, this.onboarding.guideStepIndex());
  }

  protected rerunSetup(): void {
    this.onboarding.replayWizard();
  }

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected importMessage = signal<string>('');
  protected importSuccess = signal<boolean>(false);
  protected isImporting = signal<boolean>(false);

  async onImportCSV(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isImporting.set(true);
    this.importMessage.set('');

    try {
      const count = await this.importerService.importFromFile(file);
      this.importSuccess.set(true);
      this.importMessage.set(`✅ Successfully imported ${count} habits!`);
    } catch (error) {
      this.importSuccess.set(false);
      this.importMessage.set('❌ Failed to import habits. Please check your CSV file format.');
      console.error('Import error:', error);
    } finally {
      this.isImporting.set(false);
      // Reset file input
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }
}
