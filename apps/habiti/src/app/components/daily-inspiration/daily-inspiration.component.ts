import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DailyContentService } from '../../services/daily-content.service';
import { SubscriptionService } from '../../services/subscription.service';
import { HabitsService } from '../../services/habits';
import { TasksService } from '../../services/tasks.service';
import { DailyContentCategory } from '../../models/daily-content.models';

/**
 * The dashboard's daily panel: a rotating piece of inspiration that changes
 * once a day, the things the user has already finished today, and — for free
 * members — an ad slot.
 *
 * Replaces the old static "Good morning! Ready to build great habits today?"
 * line, which said the same thing every day and earned its space accordingly.
 */
@Component({
  selector: 'app-daily-inspiration',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="mt-4 pt-4 border-t border-white/20 space-y-4">
      <!-- Daily rotating content -->
      <div class="daily-content" [attr.data-category]="category()">
        <div class="flex items-start justify-between gap-3 mb-2">
          <span class="text-[11px] uppercase tracking-wider text-white/60 flex items-center gap-1.5">
            <span>{{ categoryIcon() }}</span>
            <span>{{ categoryLabel() }} for today</span>
          </span>

          @if (isPaid()) {
            <button
              type="button"
              class="text-[11px] text-white/70 hover:text-white underline underline-offset-2 transition-colors flex-shrink-0"
              (click)="togglePicker()"
            >
              {{ showPicker() ? 'Done' : 'Change' }}
            </button>
          } @else {
            <a
              routerLink="/settings"
              class="text-[11px] text-white/70 hover:text-white underline underline-offset-2 transition-colors flex-shrink-0"
            >
              Get more
            </a>
          }
        </div>

        @if (content(); as item) {
          <!-- data-key restarts the fade when the day or category changes -->
          <blockquote class="daily-quote" [attr.data-key]="item.id">
            <p class="text-lg md:text-xl leading-relaxed">{{ item.body }}</p>
            @if (item.attribution || item.reference) {
              <footer class="mt-2 text-sm text-white/70">
                @if (item.attribution) {
                  <span>— {{ item.attribution }}</span>
                }
                @if (item.reference) {
                  <span [class.ml-1]="item.attribution">
                    {{ item.attribution ? '·' : '—' }} {{ item.reference }}
                  </span>
                }
                @if (item.translation) {
                  <span class="text-white/50"> ({{ item.translation }})</span>
                }
              </footer>
            }
          </blockquote>
        } @else {
          <p class="text-lg text-white/80">{{ greeting() }} Ready to build great habits today?</p>
        }

        <!-- Category picker (paid members) -->
        @if (showPicker() && isPaid()) {
          <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            @for (cat of categories(); track cat.id) {
              <button
                type="button"
                class="px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors border"
                [class]="
                  cat.selected
                    ? 'bg-white/25 border-white/40 text-white'
                    : 'bg-white/10 border-white/10 text-white/75 hover:bg-white/20'
                "
                (click)="choose(cat.id)"
              >
                <span class="block">{{ cat.icon }} {{ cat.label }}</span>
              </button>
            }
          </div>
        }
      </div>

      <!-- Done today -->
      <div class="pt-3 border-t border-white/10">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] uppercase tracking-wider text-white/60">Done today</span>
          <span class="text-[11px] text-white/60">{{ doneCount() }} completed</span>
        </div>

        @if (doneCount() > 0) {
          <div class="flex flex-wrap gap-2">
            @for (item of doneItems(); track item.key) {
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-sm"
                [title]="item.title"
              >
                <span aria-hidden="true">{{ item.icon }}</span>
                <span class="max-w-[12rem] truncate">{{ item.title }}</span>
              </span>
            }
          </div>
        } @else {
          <p class="text-sm text-white/70">
            Nothing checked off yet — the first one is the hardest.
          </p>
        }
      </div>

      <!-- Ad slot (free members only). Reserved at a fixed height so adding a
           real network later does not shift the page. -->
      @if (showsAds()) {
        <div class="pt-3 border-t border-white/10">
          <div
            class="ad-slot relative rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-center px-4"
            style="min-height: 90px"
            role="complementary"
            aria-label="Advertisement"
          >
            <div>
              <p class="text-sm font-semibold">Habiti Plus</p>
              <p class="text-xs text-white/70">
                Remove ads · Stoic, motivational and affirmation packs
              </p>
              <a
                routerLink="/settings"
                class="inline-block mt-1.5 text-xs font-medium underline underline-offset-2"
                >Upgrade</a
              >
            </div>
            <span class="absolute top-1 right-2 text-[9px] uppercase tracking-wider text-white/40"
              >Ad</span
            >
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .daily-quote {
        animation: di-fade-in 0.45s ease-out;
      }
      .daily-quote p {
        text-wrap: pretty;
      }
      @keyframes di-fade-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .daily-quote {
          animation: none;
        }
      }
    `
  ]
})
export class DailyInspirationComponent {
  private dailyContent = inject(DailyContentService);
  private subscription = inject(SubscriptionService);
  private habitsService = inject(HabitsService);
  private tasksService = inject(TasksService);

  protected readonly content = this.dailyContent.today;
  protected readonly category = this.dailyContent.category;
  protected readonly categories = this.dailyContent.categories;
  protected readonly isPaid = this.subscription.isPaid;
  protected readonly showsAds = this.subscription.showsAds;
  protected readonly showPicker = signal(false);

  protected readonly categoryLabel = computed(
    () => this.categories().find(c => c.id === this.category())?.label ?? 'Daily'
  );
  protected readonly categoryIcon = computed(
    () => this.categories().find(c => c.id === this.category())?.icon ?? '✨'
  );

  /** Habits and tasks the user has already finished today. */
  protected readonly doneItems = computed(() => {
    const habits = this.habitsService
      .getTodaysHabitSummary()
      .habits.map(h => ({ key: `habit-${h.id}`, title: h.name, icon: h.icon || '✅' }));

    const tasks = (this.tasksService.todaysTasks?.() ?? [])
      .filter((t: any) => t.completed)
      .map((t: any) => ({ key: `task-${t.id}`, title: t.title, icon: '📝' }));

    return [...habits, ...tasks];
  });

  protected readonly doneCount = computed(() => this.doneItems().length);

  protected togglePicker(): void {
    this.showPicker.update(open => !open);
  }

  protected choose(category: DailyContentCategory): void {
    this.dailyContent.setCategory(category);
    this.showPicker.set(false);
  }

  /** Only used when there is no content at all to show. */
  protected greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening!';
  }
}
