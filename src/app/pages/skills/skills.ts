import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SkillsService } from '../../services/skills.service';
import { HabitsService, Habit } from '../../services/habits';
import { TemplatePickerComponent } from '../../components/template-picker/template-picker.component';
import {
  SkillStarterPickerComponent,
  StarterSelection
} from '../../components/skill-starter-picker/skill-starter-picker.component';
import { ChallengeService } from '../../services/challenge.service';
import { ChallengeDifficulty, ChallengeTemplate } from '../../models/challenge.models';
import { HabitTemplatePack, isAlreadyAdded } from '../../config/habit-template-packs';
import {
  SKILL_CATALOGUE,
  SkillDefinition,
  findSkill,
  practiceHabits,
  searchSkills,
  skillCategory
} from '../../config/skill-catalogue';
import { SkillTrack } from '../../models/skill.models';

type Tab = 'mine' | 'browse';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplatePickerComponent, SkillStarterPickerComponent],
  templateUrl: './skills.html',
  styleUrl: './skills.scss'
})
export class SkillsComponent {
  private skills = inject(SkillsService);
  private habitsService = inject(HabitsService);
  private challenges = inject(ChallengeService);

  protected readonly catalogue = SKILL_CATALOGUE;
  protected readonly tracks = this.skills.tracks;
  protected readonly activeTracks = this.skills.activeTracks;
  protected readonly canStart = this.skills.canStartSkills;

  protected readonly tab = signal<Tab>('mine');
  protected readonly query = signal('');
  /**
   * The open skill dialog, held by ID rather than as a snapshot.
   *
   * A background sync replaces the tracks array, and a stored object would keep
   * rendering pre-refresh numbers.
   */
  protected readonly detailSkillId = signal<string | null>(null);
  protected readonly suggestedPack = signal<HabitTemplatePack | null>(null);
  /** The skill whose starter work is being offered, after habits are chosen. */
  protected readonly starterFor = signal<SkillDefinition | null>(null);

  /** Campaign chooser state, shown inside the skill dialog. */
  protected readonly choosingCampaign = signal(false);
  protected readonly chosenDifficulty = signal<ChallengeDifficulty>('medium');

  private pendingTrackId: string | null = null;

  constructor() {
    // Land on Browse when there is nothing to show yet.
    if (this.activeTracks().length === 0) this.tab.set('browse');
  }

  // --- browse ------------------------------------------------------------

  protected readonly visibleCatalogue = computed(() => {
    const term = this.query().trim();
    if (!term) return this.catalogue;

    const matches = new Set(searchSkills(term).map(s => s.id));
    return this.catalogue
      .map(section => ({ ...section, skills: section.skills.filter(s => matches.has(s.id)) }))
      .filter(section => section.skills.length > 0);
  });

  protected readonly resultCount = computed(() =>
    this.visibleCatalogue().reduce((n, section) => n + section.skills.length, 0)
  );

  // --- detail ------------------------------------------------------------

  protected readonly detail = computed<SkillDefinition | null>(() => {
    const id = this.detailSkillId();
    return id ? findSkill(id) ?? null : null;
  });

  protected readonly detailTrack = computed<SkillTrack | null>(() => {
    const id = this.detailSkillId();
    return id ? this.skills.trackFor(id) ?? null : null;
  });

  protected readonly detailLadder = computed(() => {
    const track = this.detailTrack();
    const definition = this.detail();
    return track && definition ? this.skills.ladder(track, definition) : [];
  });

  /**
   * The gradient for a skill's card.
   *
   * Accent belongs to the CATEGORY, not the skill — one visual identity per
   * category is what makes the browse view scannable.
   */
  protected accentFor(definition: SkillDefinition): string {
    return skillCategory(definition.categoryId)?.accent ?? 'from-slate-400 to-slate-600';
  }

  protected habitsFor(definition: SkillDefinition) {
    return practiceHabits(definition);
  }

  protected trackFor(skillId: string): SkillTrack | undefined {
    return this.skills.trackFor(skillId);
  }

  protected definitionFor(track: SkillTrack): SkillDefinition | undefined {
    return findSkill(track.skillId);
  }

  protected tierName(track: SkillTrack): string {
    const definition = findSkill(track.skillId);
    if (!definition || track.tier === 0) return 'Not yet claimed';
    return definition.tiers.find(t => t.level === track.tier)?.name ?? `Tier ${track.tier}`;
  }

  protected nextStep(track: SkillTrack) {
    const definition = findSkill(track.skillId);
    return definition ? this.skills.nextStep(track, definition) : null;
  }

  protected practiceDays(track: SkillTrack): number {
    return this.skills.practiceDayCount(track);
  }

  protected isClaimable(track: SkillTrack): boolean {
    const definition = findSkill(track.skillId);
    return definition ? this.skills.isClaimable(track, definition) : false;
  }

  protected progressFraction(track: SkillTrack): number {
    const definition = findSkill(track.skillId);
    if (!definition) return 0;
    return Math.round((this.skills.progress(track, definition)?.fraction ?? 0) * 100);
  }

  // --- campaigns ---------------------------------------------------------

  /**
   * The challenge templates this skill suggests, filtered to ones that exist.
   *
   * Reads ChallengeService.templates() rather than the catalogue seed so an
   * admin-edited or archived template is reflected here too.
   */
  protected readonly campaignOptions = computed<ChallengeTemplate[]>(() => {
    const definition = this.detail();
    if (!definition) return [];
    const available = this.challenges.templates();
    return definition.campaignTemplateIds
      .map(id => available.find(t => t.id === id && t.active))
      .filter((t): t is ChallengeTemplate => !!t);
  });

  protected openCampaignChooser(): void {
    this.chosenDifficulty.set(this.challenges.defaultDifficulty());
    this.choosingCampaign.set(true);
  }

  /**
   * Starts a campaign FOR this skill.
   *
   * ChallengeService.start() is used unchanged, with the skill's bound habits
   * passed straight through as the run's habitIds. The relationship is recorded
   * on the skill side (campaignKeys) because ChallengeTerms is frozen at start
   * on purpose — see the note in challenge.models.ts.
   */
  protected startCampaign(template: ChallengeTemplate, track: SkillTrack): void {
    this.challenges
      .start(template, this.chosenDifficulty(), undefined, undefined, track.habitIds)
      .subscribe(run => {
        if (run) this.skills.bindCampaign(track.id, run.campaignKey);
        this.choosingCampaign.set(false);
      });
  }

  // --- actions -----------------------------------------------------------

  protected open(definition: SkillDefinition): void {
    this.detailSkillId.set(definition.id);
  }

  protected close(): void {
    this.detailSkillId.set(null);
    this.choosingCampaign.set(false);
  }

  /**
   * Starts a skill, then offers the practice habits the user does NOT have.
   *
   * Habits they already track were bound by the service before this ran, which
   * is why they are absent from the pack rather than missing from the skill.
   */
  protected start(definition: SkillDefinition): void {
    const owned = this.habitsService.habits();

    /**
     * Bind habits the user ALREADY tracks before the picker runs.
     *
     * The picker only reports habits it CREATED, so without this a user who
     * already deadlifts would start Strength with nothing bound and watch a
     * progress bar that can never move. Name is the only join available, and
     * it is the same key the picker's duplicate check uses.
     */
    const prebound = practiceHabits(definition)
      .map(library =>
        owned.find(h => h.name.trim().toLowerCase() === library.name.trim().toLowerCase())?.id
      )
      .filter((id): id is string => !!id);

    const track = this.skills.start(definition, prebound);
    if (!track) return;

    this.tab.set('mine');

    const missing = practiceHabits(definition).filter(h => !isAlreadyAdded(h.name, owned));
    if (missing.length === 0) {
      // Nothing to add — go straight to the starter work.
      this.offerStarterWork(definition);
      return;
    }

    this.pendingTrackId = track.id;
    this.suggestedPack.set({
      id: `skill:${definition.id}`,
      name: definition.name,
      icon: definition.icon,
      description: 'Add the habits this skill is built on. You can change these later.',
      accent: 'from-blue-500 to-indigo-600',
      habits: missing
    });
  }

  /** Binds the FINAL ids — these arrive only after the write settles. */
  protected onHabitsAdded(created: Habit[]): void {
    if (this.pendingTrackId && created.length) {
      this.skills.bindHabits(
        this.pendingTrackId,
        created.map(h => h.id)
      );
    }
  }

  protected closeSuggested(): void {
    const definition = this.detail();
    this.suggestedPack.set(null);
    // Habits first, then the one-off work — two short steps rather than one
    // long form.
    if (definition) this.offerStarterWork(definition);
  }

  private offerStarterWork(definition: SkillDefinition): void {
    if (definition.starterTasks.length === 0 && definition.starterProjects.length === 0) {
      this.pendingTrackId = null;
      return;
    }
    this.starterFor.set(definition);
  }

  /** Binds the created tasks and projects to the track. */
  protected onStarterApplied(selection: StarterSelection): void {
    const trackId = this.pendingTrackId;
    if (!trackId) return;

    for (const ref of selection.taskRefs) this.skills.bindTask(trackId, ref.key, ref.taskId);
    for (const ref of selection.projectRefs) {
      this.skills.bindProject(trackId, ref.key, ref.projectId);
    }
  }

  protected closeStarter(): void {
    this.starterFor.set(null);
    this.pendingTrackId = null;
  }

  protected claim(track: SkillTrack): void {
    const definition = findSkill(track.skillId);
    if (definition) this.skills.claimTier(track.id, definition);
  }

  protected pause(track: SkillTrack): void {
    this.skills.pause(track.id);
  }

  protected resume(track: SkillTrack): void {
    this.skills.resume(track.id);
  }

  protected abandon(track: SkillTrack): void {
    this.skills.abandon(track.id);
    this.close();
  }
}
