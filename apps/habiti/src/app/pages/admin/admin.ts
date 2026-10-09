import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BaserowService } from '../../services/baserow.service';
import {
  ALL_LIBRARY_HABITS,
  HABIT_LIBRARY,
  LIBRARY_CATEGORIES,
  LibraryHabit
} from '../../config/habit-library';
import {
  HABIT_TEMPLATE_PACKS,
  PACK_GROUPS,
  packsInGroup
} from '../../config/habit-template-packs';
import { ALL_SKILLS, practiceHabits } from '../../config/skill-catalogue';
import { CHALLENGE_CATALOGUE } from '../../config/challenge-catalogue.seed';

/**
 * One row in the catalogue-health panel.
 *
 * `ok: false` means a real defect, not a warning — every check here mirrors an
 * invariant the specs already enforce, so a red row in production means
 * something shipped that the suite would have caught.
 */
interface HealthCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** A Baserow-backed area, and whether it is actually wired up. */
interface DataSurface {
  name: string;
  icon: string;
  description: string;
  tableId: number;
  route?: string;
  editable: boolean;
}

type Inspector = 'library' | 'packs' | 'groups' | 'skills' | 'challenges';

/**
 * The admin hub.
 *
 * Two halves, and the split is the point. Baserow-backed content can be edited
 * from the app; the habit library, packs, groups and skills are TypeScript
 * pinned to a release and can only be read here. Showing them in the same list
 * with an edit button would be a lie, so they are labelled and export-only.
 *
 * The catalogue-health panel is the reason this page earns its place: it runs
 * the same integrity checks as the specs against whatever is actually loaded,
 * so a content mistake is visible without reading a CI log.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent {
  private baserow = inject(BaserowService);

  protected readonly openInspector = signal<Inspector | null>(null);
  protected readonly copied = signal<string | null>(null);

  // --- Counts ---------------------------------------------------------------

  protected readonly counts = {
    habits: ALL_LIBRARY_HABITS.length,
    categories: LIBRARY_CATEGORIES.length,
    subcategories: LIBRARY_CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0),
    packs: HABIT_TEMPLATE_PACKS.length,
    groups: PACK_GROUPS.length,
    skills: ALL_SKILLS.length,
    activeSkills: ALL_SKILLS.filter(s => s.active).length,
    challenges: CHALLENGE_CATALOGUE.length
  };

  protected readonly library = HABIT_LIBRARY;
  protected readonly packs = HABIT_TEMPLATE_PACKS;
  protected readonly groups = PACK_GROUPS;
  protected readonly skills = ALL_SKILLS;
  protected readonly challenges = CHALLENGE_CATALOGUE;

  protected packsFor(groupId: string) {
    const group = PACK_GROUPS.find(g => g.id === groupId);
    return group ? packsInGroup(group) : [];
  }

  // --- Baserow surfaces -----------------------------------------------------

  private readonly tables = environment.baserow.tables as Record<string, number>;

  protected readonly dataSurfaces: DataSurface[] = [
    {
      name: 'Challenge catalogue',
      icon: '🏆',
      description: 'Templates users can start. Editing never changes a run already in flight.',
      tableId: this.tables['challengeTemplates'] ?? 0,
      route: '/admin/challenges',
      editable: true
    },
    {
      name: 'Onboarding',
      icon: '🧭',
      description: 'One row per user: wizard status, guide progress and preferences.',
      tableId: this.tables['userOnboarding'] ?? 0,
      editable: false
    },
    {
      name: 'Mind maps',
      icon: '🧠',
      description: 'User-created maps and their nodes.',
      tableId: this.tables['mindMaps'] ?? 0,
      editable: false
    }
  ];

  /** A table id of 0 means the feature is running local-only. Worth surfacing. */
  protected readonly unconfigured = computed(() =>
    this.dataSurfaces.filter(s => !s.tableId).map(s => s.name)
  );

  // --- Catalogue health -----------------------------------------------------

  protected readonly health = computed<HealthCheck[]>(() => {
    const checks: HealthCheck[] = [];

    const shelved = PACK_GROUPS.flatMap(g => g.packIds);
    const unshelved = HABIT_TEMPLATE_PACKS.filter(p => !shelved.includes(p.id));
    checks.push({
      label: 'Every pack is shelved in a group',
      ok: unshelved.length === 0,
      detail: unshelved.length
        ? `unreachable on /templates: ${unshelved.map(p => p.id).join(', ')}`
        : `${HABIT_TEMPLATE_PACKS.length} packs across ${PACK_GROUPS.length} groups`
    });

    const duplicatelyShelved = shelved.filter((id, i) => shelved.indexOf(id) !== i);
    checks.push({
      label: 'No pack is shelved twice',
      ok: duplicatelyShelved.length === 0,
      detail: duplicatelyShelved.length
        ? `duplicated: ${[...new Set(duplicatelyShelved)].join(', ')}`
        : 'each pack appears once'
    });

    const ghostPacks = shelved.filter(id => !HABIT_TEMPLATE_PACKS.some(p => p.id === id));
    checks.push({
      label: 'Groups reference only packs that exist',
      ok: ghostPacks.length === 0,
      detail: ghostPacks.length ? `unknown: ${ghostPacks.join(', ')}` : 'all references resolve'
    });

    const emptyPacks = HABIT_TEMPLATE_PACKS.filter(p => p.habits.length === 0);
    checks.push({
      label: 'No empty pack',
      ok: emptyPacks.length === 0,
      detail: emptyPacks.length
        ? emptyPacks.map(p => p.id).join(', ')
        : `smallest has ${Math.min(...HABIT_TEMPLATE_PACKS.map(p => p.habits.length))} habits`
    });

    // practiceHabits() resolves through the throwing pick(), so a dead id here
    // is a crash on the skills page rather than a cosmetic problem.
    const brokenSkills: string[] = [];
    for (const skill of ALL_SKILLS) {
      try {
        practiceHabits(skill);
      } catch {
        brokenSkills.push(skill.id);
      }
    }
    checks.push({
      label: 'Every skill resolves its habits',
      ok: brokenSkills.length === 0,
      detail: brokenSkills.length
        ? `would crash /skills: ${brokenSkills.join(', ')}`
        : `${ALL_SKILLS.length} skills (${this.counts.activeSkills} active)`
    });

    const known = new Set(ALL_LIBRARY_HABITS.map(h => h.id));
    const brokenChallenges = CHALLENGE_CATALOGUE.filter(c =>
      (c.suggestedHabitIds ?? []).some((id: string) => !known.has(id))
    );
    checks.push({
      label: 'Every challenge suggests habits that exist',
      ok: brokenChallenges.length === 0,
      detail: brokenChallenges.length
        ? brokenChallenges.map(c => c.id).join(', ')
        : `${CHALLENGE_CATALOGUE.length} templates`
    });

    const dupeHabits = duplicates(ALL_LIBRARY_HABITS.map(h => h.id));
    checks.push({
      label: 'Library habit ids are unique',
      ok: dupeHabits.length === 0,
      detail: dupeHabits.length ? dupeHabits.join(', ') : `${ALL_LIBRARY_HABITS.length} habits`
    });

    const orphanSubcategories = ALL_LIBRARY_HABITS.filter(h => {
      const category = LIBRARY_CATEGORIES.find(c => c.id === h.categoryId);
      return !category?.subcategories.some(s => s.id === h.subcategoryId);
    });
    checks.push({
      label: 'Every habit sits in a declared subcategory',
      ok: orphanSubcategories.length === 0,
      detail: orphanSubcategories.length
        ? orphanSubcategories.slice(0, 5).map(h => h.id).join(', ')
        : `${this.counts.subcategories} subcategories`
    });

    return checks;
  });

  protected readonly healthy = computed(() => this.health().every(c => c.ok));
  protected readonly failing = computed(() => this.health().filter(c => !c.ok).length);

  // --- Inspectors -----------------------------------------------------------

  protected toggle(inspector: Inspector): void {
    this.openInspector.update(current => (current === inspector ? null : inspector));
  }

  protected habitsIn(categoryId: string): LibraryHabit[] {
    return ALL_LIBRARY_HABITS.filter(h => h.categoryId === categoryId);
  }

  /**
   * Copies a catalogue as JSON.
   *
   * Export rather than edit: these live in TypeScript, so the useful thing an
   * admin can do is get the current content out — to diff it, to hand to
   * someone writing copy, or to paste into an issue.
   */
  protected async exportJson(what: Inspector): Promise<void> {
    const payload = this.payloadFor(what);

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.copied.set(what);
      setTimeout(() => this.copied.update(c => (c === what ? null : c)), 2000);
    } catch {
      // Clipboard needs a secure context and permission; neither is guaranteed.
      // Falling back to a console dump beats a button that silently does nothing.
      console.info(`[admin] ${what} export`, payload);
      this.copied.set('console');
      setTimeout(() => this.copied.set(null), 2000);
    }
  }

  private payloadFor(what: Inspector): unknown {
    switch (what) {
      case 'library':
        return HABIT_LIBRARY;
      case 'packs':
        return HABIT_TEMPLATE_PACKS.map(p => ({ ...p, habits: p.habits.map(h => h.id) }));
      case 'groups':
        return PACK_GROUPS;
      case 'skills':
        return ALL_SKILLS;
      case 'challenges':
        return CHALLENGE_CATALOGUE;
    }
  }
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}
