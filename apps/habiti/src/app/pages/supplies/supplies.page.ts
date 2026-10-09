import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SUPPLY_CATEGORIES, SupplyKind } from '../../config/supply-catalogue';
import { LibraryEntry } from '../../config/supply-library';
import { searchSupplies } from '../../config/supply-search';
import { ToolStatus, toolCost } from '../../config/tool-cost';
import { formatMoney } from '../../config/currency';
import { CurrencyService } from '../../services/currency.service';
import { SuppliesService } from '../../services/supplies.service';

/**
 * The master list: everything that can be picked, and what this account has
 * done to it.
 *
 * ── WHAT "DELETE" MEANS HERE ──────────────────────────────────────────────
 *
 * For something of your own, delete. For a built-in entry there is no delete —
 * only hide, and reset. You cannot remove a row from a list that ships with the
 * app, because the next version of the app still has it and the disagreement
 * would have to be resolved somehow. Hiding says the same thing and is
 * reversible, which "I will never need a core drill" needs to be.
 */
@Component({
  selector: 'app-supplies',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="space-y-4">
      <div class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Tools &amp; materials</h1>
            <p class="text-slate-600 dark:text-slate-300">
              The list every project picks from. Hide what you will never use, and
              set what things cost round here.
            </p>
          </div>
          <a routerLink="/projects" class="text-sm font-medium text-blue-600">Back to projects</a>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <input
            [(ngModel)]="query"
            name="supplyQuery"
            placeholder="Search the list"
            class="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />

          @for (option of kinds; track option) {
            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-medium"
              [class]="
                kind() === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              "
              (click)="kind.set(option)"
            >
              {{ option === 'all' ? 'Everything' : option === 'tool' ? 'Tools' : 'Materials' }}
            </button>
          }

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" [checked]="showHidden()" (change)="showHidden.set(!showHidden())" class="h-4 w-4" />
            Show hidden ({{ supplies.hiddenCount() }})
          </label>
        </div>

        <div class="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-xs"
            [class]="category() === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'"
            (click)="category.set('all')"
          >
            All
          </button>
          @for (name of categories; track name) {
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs"
              [class]="category() === name ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'"
              (click)="category.set(name)"
            >
              {{ name }}
            </button>
          }
        </div>
      </div>

      <!-- Add your own. -->
      <div class="rounded-xl bg-white p-4 shadow-lg dark:bg-slate-800">
        <form class="flex flex-wrap items-end gap-2" (ngSubmit)="addOwn()">
          <input
            [(ngModel)]="newTitle"
            name="newTitle"
            placeholder="Something the list is missing"
            class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <select
            [(ngModel)]="newKind"
            name="newKind"
            class="rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="material">Material</option>
            <option value="tool">Tool</option>
          </select>
          <input
            type="number"
            step="0.01"
            [(ngModel)]="newCost"
            name="newCost"
            placeholder="Cost"
            class="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add to my list
          </button>
        </form>
      </div>

      <div class="rounded-xl bg-white shadow-lg dark:bg-slate-800">
        @if (rows().length === 0) {
          <p class="px-6 py-10 text-center text-sm text-slate-500">
            Nothing matches. Try "Show hidden", or add it above.
          </p>
        } @else {
          @for (entry of rows(); track entry.id) {
            <div
              class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0 dark:border-slate-700"
              [class.opacity-50]="entry.hidden"
            >
              <button
                type="button"
                class="shrink-0 text-lg"
                [title]="entry.favourite ? 'Unpin' : 'Pin to the top'"
                (click)="supplies.toggleFavourite(entry)"
              >
                {{ entry.favourite ? '★' : '☆' }}
              </button>

              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {{ entry.title }}
                  @if (entry.custom) {
                    <span class="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      mine
                    </span>
                  }
                </p>
                <p class="text-xs text-slate-400">
                  {{ entry.category }} · {{ entry.kind }}
                  @if (entry.sizes?.length) {
                    · {{ entry.sizes!.length }} sizes
                  }
                </p>
              </div>

              <!-- What it costs round here. Remembered between jobs, because
                   prices are local and the app has no business guessing. -->
              <input
                type="number"
                step="0.01"
                [ngModel]="entry.defaultCost ?? null"
                (ngModelChange)="setCost(entry, $event)"
                [name]="'cost-' + entry.id"
                placeholder="cost"
                class="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />

              @if (entry.kind === 'tool') {
                <select
                  [ngModel]="entry.defaultStatus ?? 'buy'"
                  (ngModelChange)="setStatus(entry, $event)"
                  [name]="'status-' + entry.id"
                  class="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="buy">buy</option>
                  <option value="hire">hire</option>
                  <option value="borrow">borrow</option>
                  <option value="own">own</option>
                </select>
              }

              @if (entry.hidden) {
                <button type="button" class="shrink-0 text-xs font-medium text-blue-600" (click)="supplies.show(entry)">
                  Show
                </button>
              } @else {
                <button type="button" class="shrink-0 text-xs text-slate-500 hover:text-slate-700" (click)="supplies.hide(entry)">
                  Hide
                </button>
              }

              @if (entry.custom) {
                <button type="button" class="shrink-0 text-xs text-slate-400 hover:text-red-600" (click)="supplies.reset(entry)">
                  Delete
                </button>
              } @else if (entry.edited) {
                <button
                  type="button"
                  class="shrink-0 text-xs text-slate-400 hover:text-slate-600"
                  title="Put it back as it ships"
                  (click)="supplies.reset(entry)"
                >
                  Reset
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `
})
export class SuppliesPage {
  protected readonly supplies = inject(SuppliesService);
  private currency = inject(CurrencyService);

  protected readonly kinds: (SupplyKind | 'all')[] = ['all', 'tool', 'material'];
  protected readonly categories = SUPPLY_CATEGORIES;

  protected query = '';
  protected newTitle = '';
  protected newKind: SupplyKind = 'material';
  protected newCost: number | null = null;

  protected readonly kind = signal<SupplyKind | 'all'>('all');
  protected readonly category = signal<string>('all');
  protected readonly showHidden = signal(false);

  private readonly visible = computed(() => this.supplies.pickable(this.showHidden()));

  /**
   * The search runs over LibraryEntry, which is not a catalogue entry — it
   * carries the account's edits. Mapping it to the shape the search expects
   * keeps one search implementation rather than two that drift.
   */
  protected rows(): LibraryEntry[] {
    const shaped = this.visible().map(entry => ({
      id: entry.id,
      name: entry.title,
      kind: entry.kind,
      category: entry.category,
      unit: entry.unit,
      sizes: entry.sizes,
      also: entry.also
    }));

    const matched = new Set(
      searchSupplies(shaped, {
        text: this.query,
        kind: this.kind(),
        category: this.category()
      }).map(entry => entry.id)
    );

    return this.visible().filter(entry => matched.has(entry.id));
  }

  protected money(amount: number): string {
    return formatMoney(amount, this.currency.home());
  }

  protected costOf(entry: LibraryEntry): number {
    return toolCost({
      id: entry.id,
      status: entry.defaultStatus ?? 'buy',
      purchaseCost: entry.defaultCost
    });
  }

  protected setCost(entry: LibraryEntry, value: number | null): void {
    this.supplies.update(entry, { defaultCost: value === null ? undefined : Number(value) });
  }

  protected setStatus(entry: LibraryEntry, value: ToolStatus): void {
    this.supplies.update(entry, { defaultStatus: value });
  }

  protected addOwn(): void {
    const title = this.newTitle.trim();
    if (!title) return;

    this.supplies.addOwn({
      title,
      kind: this.newKind,
      defaultCost: this.newCost ?? undefined,
      favourite: true
    });

    this.newTitle = '';
    this.newCost = null;
  }
}
