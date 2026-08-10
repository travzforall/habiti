import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SkillsService } from '../../services/skills.service';
import { findSkill } from '../../config/skill-catalogue';

/**
 * The dashboard's skills strip.
 *
 * A separate component purely so it can be @defer'd. The dashboard is loaded
 * EAGERLY, and this needs the skill catalogue to resolve names and ladders —
 * importing it there put ~120 kB of content into the initial bundle for every
 * user, including the ones with no skills at all.
 *
 * Identity, tier and ONE next step. Deliberately no checkboxes: ticking happens
 * on the habit cards above, and a second place to log would let the two
 * disagree.
 */
@Component({
  selector: 'app-skill-strip',
  standalone: true,
  imports: [RouterModule],
  template: `
    @if (entries().length > 0) {
      <div
        class="bg-white dark:bg-slate-800/70 rounded-2xl shadow-lg border border-slate-200/60 dark:border-slate-700/60 p-5 mb-6"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">🧭 Skills</h3>
          <a routerLink="/skills" class="text-sm font-medium text-blue-600 hover:text-blue-700">
            View all →
          </a>
        </div>

        <div class="space-y-2">
          @for (entry of entries(); track entry.track.id) {
            <a
              routerLink="/skills"
              class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span class="text-xl">{{ entry.icon }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {{ entry.name }}
                </span>
                @if (entry.next) {
                  <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">
                    {{ entry.next.label }} — {{ entry.next.have }} of {{ entry.next.need }}
                  </span>
                }
              </span>
              @if (entry.claimable) {
                <span
                  class="shrink-0 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase animate-pulse"
                >
                  Claim
                </span>
              } @else {
                <span class="shrink-0 text-xs text-slate-400">Tier {{ entry.track.tier }}/5</span>
              }
            </a>
          }
        </div>
      </div>
    }
  `
})
export class SkillStripComponent {
  private skills = inject(SkillsService);

  protected readonly entries = computed(() =>
    this.skills.activeTracks().map(track => {
      const definition = findSkill(track.skillId);
      return {
        track,
        name: definition?.name ?? track.skillId,
        icon: definition?.icon ?? '🧭',
        claimable: definition ? this.skills.isClaimable(track, definition) : false,
        next: definition ? this.skills.nextStep(track, definition) : null
      };
    })
  );
}
