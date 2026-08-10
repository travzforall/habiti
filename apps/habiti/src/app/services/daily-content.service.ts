import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaserowService } from './baserow.service';
import { SubscriptionService } from './subscription.service';
import { DAILY_CONTENT_SEED } from '../config/daily-content.seed';
import {
  DAILY_CONTENT_CATEGORY_META,
  DailyContent,
  DailyContentCategory,
  DailyContentRow,
  pickForDay,
  toDailyContent
} from '../models/daily-content.models';

const CATEGORY_KEY = 'habiti-daily-category';
const DEFAULT_CATEGORY: DailyContentCategory = 'scripture';

/**
 * Serves the dashboard's rotating daily inspiration.
 *
 * Content comes from the Baserow `daily_content` table, falling back to a
 * bundled seed set whenever that table is unset, empty, or unreachable. The
 * selection is deterministic by day, so it does not shuffle on refresh.
 */
@Injectable({ providedIn: 'root' })
export class DailyContentService {
  private baserow = inject(BaserowService);
  private subscription = inject(SubscriptionService);

  private readonly tableId = environment.baserow.tables.dailyContent;

  private readonly _remote = signal<DailyContent[] | null>(null);
  private readonly _loading = signal(false);
  private readonly _category = signal<DailyContentCategory>(this.loadCategory());
  /** Bumping this re-evaluates the pick, e.g. after midnight. */
  private readonly _today = signal(new Date());

  readonly loading = this._loading.asReadonly();

  /** Falls back to the seed set until (and unless) Baserow returns rows. */
  private readonly pool = computed<DailyContent[]>(() => this._remote() ?? DAILY_CONTENT_SEED);

  /**
   * The category actually in effect. Free members always get scripture, even
   * if a stored preference says otherwise — a lapsed subscription must not keep
   * unlocking paid categories.
   */
  readonly category = computed<DailyContentCategory>(() => {
    const preferred = this._category();
    return this.canUse(preferred) ? preferred : DEFAULT_CATEGORY;
  });

  readonly categories = computed(() =>
    Object.values(DAILY_CONTENT_CATEGORY_META).map(meta => ({
      ...meta,
      locked: !this.subscription.allows(meta.minTier),
      selected: meta.id === this.category()
    }))
  );

  /** The item for today, or null when nothing at all is available. */
  readonly today = computed<DailyContent | null>(() => {
    const category = this.category();
    const eligible = this.pool().filter(
      item => item.category === category && this.subscription.allows(item.minTier)
    );
    return pickForDay(eligible, this._today());
  });

  constructor() {
    this.load();
  }

  refresh(): Observable<void> {
    return new Observable<void>(observer => {
      this.load();
      observer.next();
      observer.complete();
    });
  }

  reset(): void {
    this._remote.set(null);
    this._loading.set(false);
  }

  load(): void {
    if (!this.tableId) {
      // Table not created yet. The seed set covers it; say so once rather than
      // failing quietly.
      console.warn('DailyContentService: baserow.tables.dailyContent is 0, using bundled seed content.');
      return;
    }

    this._loading.set(true);
    this.baserow
      .listAllRows<DailyContentRow>(this.tableId, {
        filters: [{ field: 'active', op: 'boolean', value: true }],
        orderBy: 'sort_index'
      })
      .subscribe({
        next: rows => {
          const mapped = (rows ?? []).map(toDailyContent).filter(item => item.body.trim().length > 0);
          // Empty table is not an error, but it is also not content — keep the
          // seed set rather than rendering an empty panel.
          this._remote.set(mapped.length > 0 ? mapped : null);
          this._loading.set(false);
        },
        error: err => {
          console.warn('DailyContentService: falling back to bundled content.', err);
          this._remote.set(null);
          this._loading.set(false);
        }
      });
  }

  /** Re-picks for the current date — call when the app wakes or crosses midnight. */
  refreshForToday(): void {
    this._today.set(new Date());
  }

  canUse(category: DailyContentCategory): boolean {
    return this.subscription.allows(DAILY_CONTENT_CATEGORY_META[category].minTier);
  }

  /** Returns false when the category is above the user's plan. */
  setCategory(category: DailyContentCategory): boolean {
    if (!this.canUse(category)) return false;
    this._category.set(category);
    try {
      localStorage.setItem(CATEGORY_KEY, category);
    } catch {
      // Preference is session-only if storage is unavailable.
    }
    return true;
  }

  private loadCategory(): DailyContentCategory {
    try {
      const raw = localStorage.getItem(CATEGORY_KEY) as DailyContentCategory | null;
      return raw && raw in DAILY_CONTENT_CATEGORY_META ? raw : DEFAULT_CATEGORY;
    } catch {
      return DEFAULT_CATEGORY;
    }
  }
}
