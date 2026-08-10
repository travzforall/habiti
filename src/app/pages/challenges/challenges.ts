import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChallengeService } from '../../services/challenge.service';
import { LevelService } from '../../services/level.service';
import { FriendsService } from '../../services/friends.service';
import { HabitsService } from '../../services/habits';
import { StatusAvatarComponent } from '../../components/status-avatar/status-avatar.component';
import { TemplatePickerComponent } from '../../components/template-picker/template-picker.component';
import { HabitTemplatePack, isAlreadyAdded } from '../../config/habit-template-packs';
import { pick } from '../../config/habit-library';
import type { Habit } from '../../services/habits';
import {
  CHALLENGE_CATEGORY_META,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DIFFICULTY_META,
  ChallengeDifficulty,
  ChallengeRun,
  ChallengeTemplate,
  levelValueFor,
  resolveTier
} from '../../models/challenge.models';
import { LEVEL_BAND_META } from '../../utils/level-derivation.util';
import {
  ChallengePledge,
  ChallengeSettlement,
  PLEDGE_KIND_META,
  PledgeKind,
  describePledge
} from '../../models/pledge.models';

const PLEDGE_KINDS: PledgeKind[] = ['none', 'non_monetary', 'charity_donation', 'peer_prize'];

/**
 * Browse challenges, start one at a chosen difficulty, check in, and claim the
 * levels — alone, or with a friend.
 *
 * A partnered run is the same entity as a solo one: it just has a second
 * participant. Both sides check in independently and can see each other's
 * progress.
 */
@Component({
  selector: 'app-challenge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatusAvatarComponent, TemplatePickerComponent],
  templateUrl: './challenges.html',
  styleUrl: './challenges.scss'
})
export class ChallengesComponent {
  private challengeService = inject(ChallengeService);
  private levelService = inject(LevelService);

  protected readonly catalogue = this.challengeService.catalogue;
  protected readonly activeRuns = this.challengeService.activeRuns;
  protected readonly finishedRuns = this.challengeService.finishedRuns;
  protected readonly defaultDifficulty = this.challengeService.defaultDifficulty;
  protected readonly level = this.levelService.level;

  protected readonly bandLabel = computed(() => LEVEL_BAND_META[this.levelService.band()].label);
  protected readonly bandIcon = computed(() => LEVEL_BAND_META[this.levelService.band()].icon);

  protected readonly difficulties = CHALLENGE_DIFFICULTIES;
  protected readonly difficultyMeta = CHALLENGE_DIFFICULTY_META;
  protected readonly categoryMeta = CHALLENGE_CATEGORY_META;

  /** The template whose start dialog is open, if any. */
  protected readonly starting = signal<ChallengeTemplate | null>(null);
  protected readonly chosenDifficulty = signal<ChallengeDifficulty>('medium');

  // Partnered runs
  protected readonly friends = inject(FriendsService).friends;
  protected readonly partnerInvites = this.challengeService.partnerInvites;
  protected readonly chosenPartnerId = signal<string | null>(null);

  protected readonly chosenPartner = computed(() =>
    this.friends().find(f => f.userId === this.chosenPartnerId())
  );

  // Which habits the challenge is measured against.
  protected readonly allHabits = inject(HabitsService).habits;
  protected readonly chosenHabitIds = signal<string[]>([]);

  /**
   * Suggested habits offered right after starting a challenge.
   *
   * Shaped as a template pack so it reuses the same picker as /templates —
   * one selection UI, one set of duplicate rules.
   */
  protected readonly suggestedPack = signal<HabitTemplatePack | null>(null);
  private pendingRunId: string | null = null;

  /**
   * The run whose detail popup is open — held by ID, not as a snapshot.
   *
   * A background sync replaces the runs array, so a stored object would keep
   * rendering pre-refresh data while the page around it updated.
   */
  protected readonly detailId = signal<string | null>(null);
  protected readonly detail = computed<ChallengeRun | null>(
    () =>
      [...this.activeRuns(), ...this.finishedRuns()].find(r => r.id === this.detailId()) ?? null
  );
  protected readonly detailGrid = computed(() => {
    const run = this.detail();
    return run ? this.challengeService.progressGrid(run) : null;
  });

  // Stakes. Habiti records them and never holds anything — see pledge.models.ts.
  protected readonly pledgeKinds = PLEDGE_KINDS;
  protected readonly pledgeMeta = PLEDGE_KIND_META;
  protected readonly pledgeKind = signal<PledgeKind>('none');
  protected readonly pledgeAmount = signal<number | null>(null);
  protected readonly pledgeDescription = signal('');
  protected readonly disclaimerAccepted = signal(false);

  protected readonly openSettlements = this.challengeService.openSettlements;
  protected readonly settlementsToConfirm = this.challengeService.settlementsToConfirm;
  protected readonly donationLink = this.challengeService.donationLink();
  protected readonly charityName = this.challengeService.charityName();

  protected readonly needsDisclaimer = computed(
    () => this.pledgeKind() === 'charity_donation' || this.pledgeKind() === 'peer_prize'
  );

  /** A money stake cannot be locked in until the user has been told the terms. */
  protected readonly canStart = computed(
    () => !this.needsDisclaimer() || this.disclaimerAccepted()
  );

  protected readonly startOptions = computed(() => {
    const template = this.starting();
    if (!template) return [];
    return CHALLENGE_DIFFICULTIES.map(difficulty => ({
      difficulty,
      meta: CHALLENGE_DIFFICULTY_META[difficulty],
      tier: resolveTier(template, difficulty),
      levelValue: levelValueFor(template, difficulty),
      selected: difficulty === this.chosenDifficulty()
    }));
  });

  protected openStart(template: ChallengeTemplate): void {
    this.chosenDifficulty.set(this.defaultDifficulty());
    this.chosenPartnerId.set(null);
    this.chosenHabitIds.set([]);
    this.pledgeKind.set('none');
    this.pledgeAmount.set(null);
    this.pledgeDescription.set('');
    this.disclaimerAccepted.set(false);
    this.starting.set(template);
  }

  protected closeStart(): void {
    this.starting.set(null);
  }

  /** Clicking the selected friend again clears them — back to a solo run. */
  protected choosePartner(userId: string | undefined): void {
    if (!userId) return;
    this.chosenPartnerId.update(current => (current === userId ? null : userId));
  }

  protected respondToInvite(runId: string, accept: boolean): void {
    this.challengeService.respondToInvite(runId, accept).subscribe();
  }

  protected partnerFor(run: ChallengeRun) {
    return (run.participants ?? []).find(p => !p.isOwner);
  }

  protected ownerFor(run: ChallengeRun) {
    return (run.participants ?? []).find(p => p.isOwner);
  }

  protected choose(difficulty: ChallengeDifficulty): void {
    this.chosenDifficulty.set(difficulty);
  }

  protected confirmStart(): void {
    const template = this.starting();
    if (!template) return;

    const partner = this.chosenPartner();
    this.challengeService
      .start(
        template,
        this.chosenDifficulty(),
        partner?.userId
          ? {
              userId: partner.userId,
              name: partner.name,
              email: partner.email,
              avatarUrl: partner.avatarUrl
            }
          : undefined,
        this.buildPledge(),
        this.chosenHabitIds()
      )
      .subscribe(run => {
        if (run) this.offerSuggestedHabits(template, run.id);
      });
    this.closeStart();
  }

  /**
   * Offers the challenge's habits that the user does not already have.
   *
   * Only the missing ones: a challenge whose habits you already track should
   * start silently rather than opening a dialog with nothing to do.
   */
  private offerSuggestedHabits(template: ChallengeTemplate, runId: string): void {
    // Resolved through the library, so the challenge and the template packs
    // describe the same habit identically.
    const suggested = pick(...(template.suggestedHabitIds ?? []));
    if (suggested.length === 0) return;

    const existing = this.allHabits();
    const missing = suggested.filter(habit => !isAlreadyAdded(habit.name, existing));
    if (missing.length === 0) return;

    this.pendingRunId = runId;
    this.suggestedPack.set({
      id: `challenge:${template.id}`,
      name: template.title,
      icon: template.icon,
      description: 'Add the habits this challenge tracks, so the grid has something to fill in.',
      accent: 'from-blue-500 to-indigo-600',
      habits: missing
    });
  }

  /**
   * Binds the newly created habits to the run.
   *
   * These ids come from the picker only AFTER the write settles, so they are
   * Baserow's row ids — binding the temporary local ids would point the
   * challenge at habits that no longer exist under those ids.
   */
  protected onSuggestedHabitsAdded(created: Habit[]): void {
    const runId = this.pendingRunId;
    if (!runId || created.length === 0) return;

    const run = this.activeRuns().find(r => r.id === runId);
    const existing = run?.terms.habitIds ?? [];
    const merged = [...new Set([...existing, ...created.map(h => h.id)])];

    this.challengeService.setBoundHabits(runId, merged).subscribe();
  }

  protected closeSuggested(): void {
    this.suggestedPack.set(null);
    this.pendingRunId = null;
  }

  private buildPledge(): ChallengePledge | undefined {
    const kind = this.pledgeKind();
    if (kind === 'none') return undefined;

    return {
      kind,
      amount: this.pledgeAmount() ?? undefined,
      currency: 'USD',
      description: this.pledgeDescription().trim() || undefined,
      beneficiary: kind === 'peer_prize' ? 'counterparty' : 'iluv_foundation_project_africa',
      disclaimerAccepted: this.disclaimerAccepted()
    };
  }

  protected toggleHabit(habitId: string): void {
    this.chosenHabitIds.update(ids =>
      ids.includes(habitId) ? ids.filter(id => id !== habitId) : [...ids, habitId]
    );
  }

  protected openDetail(run: ChallengeRun): void {
    this.detailId.set(run.id);
    this.editingHabits.set(false);
    this.detailHabitIds.set([...(run.terms.habitIds ?? [])]);
  }

  protected closeDetail(): void {
    this.detailId.set(null);
    this.editingHabits.set(false);
  }

  /** Editing which habits a RUNNING challenge tracks. The payout stays frozen. */
  protected readonly editingHabits = signal(false);
  protected readonly detailHabitIds = signal<string[]>([]);

  protected startEditingHabits(): void {
    const run = this.detail();
    this.detailHabitIds.set([...(run?.terms.habitIds ?? [])]);
    this.editingHabits.set(true);
  }

  protected toggleDetailHabit(habitId: string): void {
    this.detailHabitIds.update(ids =>
      ids.includes(habitId) ? ids.filter(id => id !== habitId) : [...ids, habitId]
    );
  }

  protected saveDetailHabits(): void {
    const run = this.detail();
    if (!run) return;

    // No need to re-set the detail — the computed picks the change up from runs.
    this.challengeService.setBoundHabits(run.id, this.detailHabitIds()).subscribe(() => {
      this.editingHabits.set(false);
    });
  }

  /** Short column label — the day of the month. */
  protected dayLabel(date: string): string {
    return String(Number(date.split('-')[2]));
  }

  protected setPledgeKind(kind: PledgeKind): void {
    this.pledgeKind.set(kind);
    if (kind === 'none') this.disclaimerAccepted.set(false);
  }

  protected describe(pledge: ChallengePledge | undefined): string {
    return describePledge(pledge);
  }

  protected settle(settlement: ChallengeSettlement): void {
    this.challengeService.markSettled(settlement.id).subscribe();
  }

  protected confirmSettled(settlement: ChallengeSettlement): void {
    this.challengeService.confirmSettled(settlement.id).subscribe();
  }

  protected waive(settlement: ChallengeSettlement): void {
    this.challengeService.waiveSettlement(settlement.id).subscribe();
  }

  protected readonly habitsToday = this.challengeService.habitsCompletedToday;

  protected progress(run: ChallengeRun) {
    return this.challengeService.progressFor(run);
  }

  /** Whether today's habit data backs a check-in. Informational, not a gate. */
  protected isBacked(run: ChallengeRun): boolean {
    return this.challengeService.isCheckInBacked(run);
  }

  protected checkIn(run: ChallengeRun): void {
    this.challengeService.checkIn(run.id).subscribe();
  }

  protected complete(run: ChallengeRun): void {
    this.challengeService.complete(run.id).subscribe();
  }

  protected abandon(run: ChallengeRun): void {
    this.challengeService.abandon(run.id).subscribe();
  }

  protected difficultyLabel(difficulty: ChallengeDifficulty): string {
    return CHALLENGE_DIFFICULTY_META[difficulty].label;
  }
}
