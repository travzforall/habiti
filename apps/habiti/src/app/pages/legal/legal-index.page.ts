import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_DOCUMENT_ORDER, LEGAL_INDEX, legalRoute } from '../../config/legal/registry';

/**
 * The index of legal documents. Public — no guard.
 *
 * Reads only the registry, never the prose, so landing here does not fetch
 * seven documents.
 */
@Component({
  selector: 'app-legal-index',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold text-slate-900">Legal</h1>
    <p class="mt-2 text-slate-600">
      Everything here is versioned and dated. You can read any earlier version and see what changed.
    </p>

    <ul class="mt-8 space-y-3">
      @for (id of order; track id) {
        @let entry = index[id];
        <li>
          <a
            [routerLink]="route(id)"
            class="block rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h2 class="font-semibold text-slate-900">{{ entry.title }}</h2>
                <p class="mt-1 text-sm text-slate-600">{{ entry.summary }}</p>
              </div>
              @if (entry.status === 'draft') {
                <span
                  class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800"
                >
                  Draft
                </span>
              }
            </div>
            <p class="mt-3 text-xs text-slate-500">
              Version {{ entry.currentVersion }} · effective {{ entry.effectiveFrom }}
            </p>
          </a>
        </li>
      }
    </ul>

    <p class="mt-8 text-sm text-slate-500">
      Looking for how Habiti is built and secured? See our
      <a routerLink="/trust" class="font-medium text-blue-600 hover:underline">Trust page</a>.
    </p>
  `
})
export class LegalIndexPage {
  protected readonly order = LEGAL_DOCUMENT_ORDER;
  protected readonly index = LEGAL_INDEX;
  protected readonly route = legalRoute;
}
