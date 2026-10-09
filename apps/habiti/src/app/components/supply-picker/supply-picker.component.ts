import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SUPPLY_CATEGORIES, SupplyKind } from '../../config/supply-catalogue';
import { LibraryEntry } from '../../config/supply-library';
import { searchSupplies } from '../../config/supply-search';
import { SuppliesService } from '../../services/supplies.service';
import { readProductLink } from '../../config/product-links';
import { ToolStatus } from '../../config/tool-cost';
import { ProjectBudgetService } from '../../services/project-budget.service';

/**
 * Picking a job's tools and materials from a list, into a queue.
 *
 * ── WHY A QUEUE AND NOT A FORM ────────────────────────────────────────────
 *
 * Kitting out a job is one decision made forty times, and a form that saves
 * after every line makes you pay for the interruption forty times. Here the
 * choosing is fast and lossy — tap, tap, tap down a filtered list — and the
 * committing happens once, at the end, when the queue is right. Nothing is
 * written until "Add to the project" is pressed, so changing your mind costs
 * nothing.
 *
 * The queue is also where the DETAIL goes: a size, a quantity, whether the saw
 * is being hired or is already in the shed. Asking that at the moment of
 * choosing would slow the choosing down; asking it never would leave a list
 * that says "screws" and helps nobody.
 */

interface QueueLine {
  key: string;
  title: string;
  kind: SupplyKind;
  unit?: string;
  sizes?: string[];
  size?: string;
  quantity: number;
  /** Tools only. */
  status: ToolStatus;
  unitCost: number | null;
  hireDays: number | null;
  source?: string;
  url?: string;
  sku?: string;
  /** True when it came from a pasted link and still needs a price. */
  needsPrice?: boolean;
}

@Component({
  selector: 'app-supply-picker',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="font-semibold text-slate-900 dark:text-white">Add tools &amp; materials</h3>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" [checked]="showHidden()" (change)="showHidden.set(!showHidden())" class="h-3.5 w-3.5" />
            Show all
          </label>
          <a routerLink="/supplies" class="text-xs font-medium text-blue-600">Edit my list</a>
          <button type="button" class="text-sm text-slate-500 hover:text-slate-700" (click)="closed.emit()">
            Close
          </button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Choosing. -->
        <div>
          <input
            [(ngModel)]="query"
            name="supplyQuery"
            placeholder="mitre saw, 1/2 plywood, screws…"
            class="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />

          <div class="mb-2 flex flex-wrap gap-1">
            @for (option of kinds; track option) {
              <button
                type="button"
                class="rounded-full px-2.5 py-1 text-xs font-medium"
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
          </div>

          <div class="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs"
              [class]="
                category() === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              "
              (click)="category.set('all')"
            >
              All
            </button>
            @for (name of categories; track name) {
              <button
                type="button"
                class="rounded-full px-2.5 py-1 text-xs"
                [class]="
                  category() === name
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                "
                (click)="category.set(name)"
              >
                {{ name }}
              </button>
            }
          </div>

          <div class="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            @for (entry of results(); track entry.id) {
              <button
                type="button"
                class="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                (click)="queueEntry(entry)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-slate-800 dark:text-slate-100">
                    {{ entry.title }}
                    @if (entry.favourite) {
                      <span class="text-amber-500">★</span>
                    }
                  </span>
                  <span class="block text-xs text-slate-400">
                    {{ entry.category }}
                    @if (entry.sizes?.length) {
                      · {{ entry.sizes!.length }} sizes
                    }
                  </span>
                </span>
                <span class="shrink-0 text-xs text-blue-600">add</span>
              </button>
            } @empty {
              <p class="px-3 py-6 text-center text-sm text-slate-500">
                Nothing matches. Paste a link below to add it anyway.
              </p>
            }
          </div>

          <!--
            The link importer.

            It reads the address, not the page: no shop allows a browser to
            fetch it, and routing every product through a server of ours to
            save typing a price is a worse trade than typing the price.
          -->
          <form class="mt-2 flex gap-2" (ngSubmit)="importLink()">
            <input
              [(ngModel)]="link"
              name="supplyLink"
              placeholder="Paste a Home Depot, Screwfix or Amazon link"
              class="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:text-slate-200">
              Read it
            </button>
          </form>
          @if (linkError()) {
            <p class="mt-1 text-xs text-red-600">{{ linkError() }}</p>
          }
        </div>

        <!-- The queue. -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
              Queue <span class="font-normal text-slate-500">{{ queue().length }}</span>
            </h4>
            @if (queue().length > 0) {
              <button type="button" class="text-xs text-slate-500 hover:text-red-600" (click)="clear()">
                Clear
              </button>
            }
          </div>

          @if (queue().length === 0) {
            <p class="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
              Pick from the list. Nothing is saved until you add the queue.
            </p>
          } @else {
            <div class="max-h-72 space-y-2 overflow-y-auto pr-1">
              @for (line of queue(); track line.key) {
                <div class="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <div class="flex items-start gap-2">
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {{ line.title }}
                      </span>
                      @if (line.sku) {
                        <span class="block text-[11px] text-slate-400">#{{ line.sku }}</span>
                      }
                    </span>
                    <button
                      type="button"
                      class="shrink-0 text-xs text-slate-400 hover:text-red-600"
                      (click)="remove(line.key)"
                      aria-label="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>

                  <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                    @if (line.sizes?.length) {
                      <select
                        [ngModel]="line.size"
                        (ngModelChange)="setSize(line.key, $event)"
                        [name]="'size-' + line.key"
                        class="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      >
                        @for (size of line.sizes!; track size) {
                          <option [value]="size">{{ size }}</option>
                        }
                      </select>
                    }

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      [ngModel]="line.quantity"
                      (ngModelChange)="setQuantity(line.key, $event)"
                      [name]="'qty-' + line.key"
                      class="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    @if (line.unit) {
                      <span class="text-xs text-slate-400">{{ line.unit }}</span>
                    }

                    @if (line.kind === 'tool') {
                      <select
                        [ngModel]="line.status"
                        (ngModelChange)="setStatus(line.key, $event)"
                        [name]="'status-' + line.key"
                        class="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="buy">buy</option>
                        <option value="hire">hire</option>
                        <option value="borrow">borrow</option>
                        <option value="own">own</option>
                      </select>
                    }

                    <!-- Price is asked for only where it is owed: a borrowed
                         ladder has no price, and an empty box implying one is
                         a question with no right answer. -->
                    @if (needsCost(line)) {
                      <input
                        type="number"
                        step="0.01"
                        [ngModel]="line.unitCost"
                        (ngModelChange)="setCost(line.key, $event)"
                        [name]="'cost-' + line.key"
                        [placeholder]="line.kind === 'tool' && line.status === 'hire' ? 'per day' : 'each'"
                        class="w-20 rounded border px-1.5 py-0.5 text-xs dark:bg-slate-900 dark:text-white"
                        [class]="
                          line.needsPrice && line.unitCost === null
                            ? 'border-amber-400'
                            : 'border-slate-300 dark:border-slate-600'
                        "
                      />
                    }

                    @if (line.kind === 'tool' && line.status === 'hire') {
                      <input
                        type="number"
                        min="1"
                        [ngModel]="line.hireDays"
                        (ngModelChange)="setDays(line.key, $event)"
                        [name]="'days-' + line.key"
                        placeholder="days"
                        class="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    }
                  </div>
                </div>
              }
            </div>

            @if (missingPrices() > 0) {
              <p class="mt-2 text-xs text-amber-600">
                {{ missingPrices() }} from a link still need{{ missingPrices() === 1 ? 's' : '' }} a price —
                no shop link contains one.
              </p>
            }

            <button
              type="button"
              class="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
              (click)="commit()"
            >
              Add {{ queue().length }} to the project
            </button>
          }
        </div>
      </div>
    </div>
  `
})
export class SupplyPickerComponent {
  readonly projectId = input.required<string>();
  /** Set when the picker was opened from a task, so lines land on it. */
  readonly taskId = input<string | undefined>(undefined);
  readonly milestoneId = input<string | undefined>(undefined);
  readonly currency = input<string | undefined>(undefined);

  readonly closed = output<void>();
  readonly added = output<number>();

  private budget = inject(ProjectBudgetService);
  private supplies = inject(SuppliesService);

  protected readonly kinds: (SupplyKind | 'all')[] = ['all', 'tool', 'material'];
  protected readonly categories = SUPPLY_CATEGORIES;

  protected query = '';
  protected link = '';

  protected readonly kind = signal<SupplyKind | 'all'>('all');
  protected readonly category = signal<string>('all');
  protected readonly queue = signal<QueueLine[]>([]);
  protected readonly showHidden = signal(false);
  protected readonly linkError = signal<string | null>(null);

  /**
   * `query` is a plain field bound with ngModel, so the results have to be
   * recomputed on each pass rather than derived from a signal. The catalogue is
   * a few hundred rows and the search is a filter — cheap enough to keep the
   * binding simple.
   */
  protected results(): LibraryEntry[] {
    // The account's list, not the shipped catalogue: hidden things stay out,
    // their prices are remembered, and anything they added is in.
    const visible = this.supplies.pickable(this.showHidden());

    const matched = new Set(
      searchSupplies(
        visible.map(entry => ({
          id: entry.id,
          name: entry.title,
          kind: entry.kind,
          category: entry.category,
          unit: entry.unit,
          sizes: entry.sizes,
          also: entry.also
        })),
        { text: this.query, kind: this.kind(), category: this.category() }
      ).map(entry => entry.id)
    );

    return visible.filter(entry => matched.has(entry.id)).slice(0, 60);
  }

  protected readonly missingPrices = computed(
    () => this.queue().filter(line => line.needsPrice && line.unitCost === null).length
  );

  protected needsCost(line: QueueLine): boolean {
    if (line.kind === 'material') return true;
    return line.status === 'buy' || line.status === 'hire';
  }

  protected queueEntry(entry: LibraryEntry): void {
    this.queue.update(lines => [
      ...lines,
      {
        key: `${entry.id}-${lines.length}`,
        title: entry.title,
        kind: entry.kind,
        unit: entry.unit,
        sizes: entry.sizes,
        size: entry.sizes?.[0],
        quantity: 1,
        status: entry.defaultStatus ?? 'buy',
        // The price this account last said it costs — the whole reason the
        // master list is worth keeping.
        unitCost: entry.defaultCost ?? null,
        hireDays: entry.defaultStatus === 'hire' ? 1 : null,
        url: entry.url,
        sku: entry.sku
      }
    ]);
  }

  protected importLink(): void {
    const found = readProductLink(this.link);
    if (!found) {
      this.linkError.set('That does not look like a web address.');
      return;
    }

    this.linkError.set(null);
    this.queue.update(lines => [
      ...lines,
      {
        key: `link-${lines.length}-${found.sku ?? found.url.length}`,
        title: found.title ?? found.retailer ?? 'From a link',
        // A shop link is nearly always something being bought, and a tool is
        // the safe guess: it shows on the "to get" list either way.
        kind: 'tool',
        quantity: 1,
        status: 'buy',
        unitCost: null,
        hireDays: null,
        source: found.retailer,
        url: found.url,
        sku: found.sku,
        needsPrice: true
      }
    ]);
    this.link = '';
  }

  protected setSize(key: string, size: string): void {
    this.patch(key, { size });
  }

  protected setQuantity(key: string, quantity: number): void {
    this.patch(key, { quantity: Number(quantity) || 1 });
  }

  protected setStatus(key: string, status: ToolStatus): void {
    this.patch(key, { status });
  }

  protected setCost(key: string, unitCost: number | null): void {
    this.patch(key, { unitCost: unitCost === null ? null : Number(unitCost) });
  }

  protected setDays(key: string, hireDays: number | null): void {
    this.patch(key, { hireDays: hireDays === null ? null : Number(hireDays) });
  }

  private patch(key: string, changes: Partial<QueueLine>): void {
    this.queue.update(lines =>
      lines.map(line => (line.key === key ? { ...line, ...changes } : line))
    );
  }

  protected remove(key: string): void {
    this.queue.update(lines => lines.filter(line => line.key !== key));
  }

  protected clear(): void {
    this.queue.set([]);
  }

  /**
   * Writes the queue, once.
   *
   * A material becomes an item and a tool becomes a tool, because the two are
   * counted differently — see config/tool-cost.ts. The size becomes part of the
   * name: "Plywood sheet (1/2 in)" is what you say at the counter, and a
   * separate size field nobody reads helps nobody.
   */
  protected commit(): void {
    const lines = this.queue();

    for (const line of lines) {
      const title = line.size ? `${line.title} (${line.size})` : line.title;

      if (line.kind === 'material') {
        this.budget.addItem(this.projectId(), {
          title,
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost ?? undefined,
          url: line.url,
          note: line.sku ? `SKU ${line.sku}` : undefined,
          supplier: line.source,
          taskId: this.taskId(),
          milestoneId: this.milestoneId(),
          currency: this.currency()
        });
      } else {
        this.budget.addTool(this.projectId(), {
          title,
          status: line.status,
          source: line.source,
          purchaseCost: line.status === 'buy' ? (line.unitCost ?? undefined) : undefined,
          hireRate: line.status === 'hire' ? (line.unitCost ?? undefined) : undefined,
          hireDays: line.status === 'hire' ? (line.hireDays ?? undefined) : undefined,
          // The tools table has no url column; the link is worth keeping
          // somewhere a person will find it.
          note: [line.url, line.sku ? `SKU ${line.sku}` : undefined].filter(Boolean).join(' · ') || undefined,
          taskId: this.taskId(),
          milestoneId: this.milestoneId(),
          currency: this.currency()
        });
      }
    }

    this.added.emit(lines.length);
    this.queue.set([]);
    this.closed.emit();
  }
}
