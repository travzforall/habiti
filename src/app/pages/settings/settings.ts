import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';
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
  imports: [CommonModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private habitsService = inject(HabitsService);
  private importerService = inject(HabitImporterService);
  private challengeService = inject(ChallengeService);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;

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
