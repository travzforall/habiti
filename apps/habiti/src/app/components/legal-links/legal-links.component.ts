import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_DOCUMENT_ORDER, LEGAL_INDEX, legalRoute } from '../../config/legal/registry';

/**
 * Links to the legal documents.
 *
 * Reads only the registry — a few hundred bytes of ids and versions — never the
 * prose, so putting this on the sign-in page does not drag seven documents into
 * the initial bundle.
 *
 * Deliberately NOT the existing footer component: that one renders habit stats
 * and an export button, so it assumes a signed-in user, and it is dead code
 * nothing has rendered for some time.
 */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [class]="layout() === 'inline' ? 'flex flex-wrap gap-x-4 gap-y-1' : 'space-y-2'">
      @for (id of order; track id) {
        @let entry = index[id];
        @if (layout() === 'inline') {
          <a
            [routerLink]="route(id)"
            class="text-sm text-slate-500 transition-colors hover:text-blue-600 hover:underline"
          >
            {{ entry.title }}
          </a>
        } @else {
          <a
            [routerLink]="route(id)"
            class="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
          >
            <span class="text-sm text-slate-700">{{ entry.title }}</span>
            <span class="shrink-0 text-xs text-slate-400">
              v{{ entry.currentVersion }}
              @if (entry.status === 'draft') {
                · draft
              }
            </span>
          </a>
        }
      }
    </nav>
  `
})
export class LegalLinksComponent {
  /** `inline` for a footer row; `list` for a settings card. */
  readonly layout = input<'inline' | 'list'>('inline');

  protected readonly order = LEGAL_DOCUMENT_ORDER;
  protected readonly index = LEGAL_INDEX;
  protected readonly route = legalRoute;
}
