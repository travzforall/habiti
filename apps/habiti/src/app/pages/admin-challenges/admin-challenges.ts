import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ChallengeService } from '../../services/challenge.service';
import {
  CHALLENGE_CATEGORY_META,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DIFFICULTY_META,
  ChallengeCategory,
  ChallengeDifficulty,
  ChallengeTemplate,
  ChallengeTemplateRow,
  periodsFor,
  resolveTier
} from '../../models/challenge.models';
import { BaserowService } from '../../services/baserow.service';

/**
 * Manage the challenge catalogue.
 *
 * ⚠ There is no admin role in this app. AuthGuard means "logged in", nothing
 * more, and the Baserow token is client-side — so any signed-in user can reach
 * this page and write these rows. It is unlisted rather than protected. Treat
 * it as an internal tool until the Xano proxy lands.
 *
 * Editing a level value here does NOT change any run already in flight: a run
 * freezes its payout into `terms` at start. That is what makes this safe to
 * edit at all.
 */
@Component({
  selector: 'app-admin-challenges',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-challenges.html',
  styleUrl: './admin-challenges.scss'
})
export class AdminChallengesComponent {
  private challengeService = inject(ChallengeService);
  private baserow = inject(BaserowService);

  protected readonly templates = this.challengeService.templates;
  protected readonly categories = Object.keys(CHALLENGE_CATEGORY_META) as ChallengeCategory[];
  protected readonly categoryMeta = CHALLENGE_CATEGORY_META;
  protected readonly difficulties = CHALLENGE_DIFFICULTIES;
  protected readonly difficultyMeta = CHALLENGE_DIFFICULTY_META;

  protected readonly tableId = environment.baserow.tables.challengeTemplates;
  protected readonly isConfigured = !!this.tableId;

  /** Baserow row ids by template id, so an edit knows what to PATCH. */
  private readonly rowIds = signal<Record<string, number>>({});

  protected readonly editing = signal<ChallengeTemplate | null>(null);
  protected readonly isNew = signal(false);
  protected readonly saving = signal(false);

  /** Which templates live only in code — those can be overridden, not edited. */
  protected readonly seedOnly = computed(() => {
    const ids = this.rowIds();
    return new Set(this.templates().filter(t => !ids[t.id]).map(t => t.id));
  });

  protected readonly tierRows = computed(() => {
    const template = this.editing();
    if (!template) return [];
    return CHALLENGE_DIFFICULTIES.map(difficulty => ({
      difficulty,
      meta: CHALLENGE_DIFFICULTY_META[difficulty],
      tier: resolveTier(template, difficulty)
    }));
  });

  constructor() {
    this.loadRowIds();
  }

  protected periods(template: ChallengeTemplate): number {
    return periodsFor(template);
  }

  protected levelValues(template: ChallengeTemplate): string {
    return CHALLENGE_DIFFICULTIES.map(d => resolveTier(template, d).levelValue).join(' / ');
  }

  protected create(): void {
    this.isNew.set(true);
    this.editing.set({
      id: '',
      title: '',
      description: '',
      icon: '🏆',
      category: 'discipline',
      durationDays: 7,
      cadence: 'daily',
      baseLevelValue: 5,
      tiers: {},
      minTier: 'free',
      allowsPartner: true,
      sortIndex: this.templates().length + 1,
      active: true
    });
  }

  protected edit(template: ChallengeTemplate): void {
    this.isNew.set(false);
    // Deep-ish copy so cancelling does not leave edits behind.
    this.editing.set({ ...template, tiers: JSON.parse(JSON.stringify(template.tiers ?? {})) });
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected setField<K extends keyof ChallengeTemplate>(key: K, value: ChallengeTemplate[K]): void {
    this.editing.update(t => (t ? { ...t, [key]: value } : t));
  }

  /** Writes an explicit tier so the value is not re-synthesized from the base. */
  protected setTierValue(difficulty: ChallengeDifficulty, levelValue: number): void {
    this.editing.update(template => {
      if (!template) return template;
      const current = resolveTier(template, difficulty);
      return {
        ...template,
        tiers: {
          ...template.tiers,
          [difficulty]: { ...current, levelValue: Math.max(1, Math.floor(levelValue) || 1) }
        }
      };
    });
  }

  protected save(): void {
    const template = this.editing();
    if (!template || this.saving()) return;

    const id = (template.id || slug(template.title)).trim();
    if (!id || !template.title.trim()) return;

    this.saving.set(true);
    const rowId = this.rowIds()[id];

    this.challengeService.saveTemplate({ ...template, id }, rowId).subscribe(ok => {
      this.saving.set(false);
      if (ok) {
        this.editing.set(null);
        this.loadRowIds();
      }
    });
  }

  protected archive(template: ChallengeTemplate): void {
    const rowId = this.rowIds()[template.id];
    if (!rowId) {
      // Code-only templates cannot be archived from here — saving an inactive
      // copy creates the override row instead.
      this.challengeService.saveTemplate({ ...template, active: false }).subscribe(() => this.loadRowIds());
      return;
    }
    this.challengeService.archiveTemplate(template, rowId).subscribe(() => this.loadRowIds());
  }

  protected restore(template: ChallengeTemplate): void {
    const rowId = this.rowIds()[template.id];
    this.challengeService.saveTemplate({ ...template, active: true }, rowId).subscribe(() => this.loadRowIds());
  }

  private loadRowIds(): void {
    if (!this.tableId) return;
    this.baserow.listAllRows<ChallengeTemplateRow>(this.tableId).subscribe(rows => {
      const map: Record<string, number> = {};
      for (const row of rows ?? []) if (row.template_id) map[row.template_id] = row.id;
      this.rowIds.set(map);
    });
  }
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
