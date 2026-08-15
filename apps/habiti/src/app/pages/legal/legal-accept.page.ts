import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LEGAL_INDEX } from '../../config/legal/registry';
import { LegalDocumentId } from '../../config/legal/types';
import { ConsentService } from '../../services/consent.service';

/**
 * The re-acceptance gate.
 *
 * Reached when a document has changed MATERIALLY since the user last accepted
 * it — a change to what is collected, who receives it, retention, transfers,
 * rights, liability or fees. An editorial fix does not raise the floor and so
 * never lands anyone here; re-prompting people for a corrected apostrophe is
 * how they learn to click through the one that matters.
 *
 * Deliberately not a modal. This is a decision with consequences, and a dialog
 * that can be dismissed by clicking beside it is the wrong shape for one.
 */
@Component({
  selector: 'app-legal-accept',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold text-slate-900">We have updated our terms</h1>

    @if (outstanding().length > 0) {
      <p class="mt-3 text-slate-600">
        {{
          outstanding().length === 1
            ? 'One document has changed in a way that affects you.'
            : 'Some documents have changed in ways that affect you.'
        }}
        Please read {{ outstanding().length === 1 ? 'it' : 'them' }} before carrying on.
      </p>

      <ul class="mt-6 space-y-3">
        @for (id of outstanding(); track id) {
          @let entry = index[id];
          <li class="rounded-2xl border border-slate-200 bg-white p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h2 class="font-semibold text-slate-900">{{ entry.title }}</h2>
                <p class="mt-1 text-sm text-slate-600">{{ entry.summary }}</p>
                <p class="mt-2 text-xs text-slate-500">
                  Version {{ entry.currentVersion }} · effective {{ entry.effectiveFrom }}
                </p>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-4 text-sm">
              <a [routerLink]="['/legal', id]" target="_blank" class="text-blue-600 hover:underline">
                Read it
              </a>
              @if (previousVersion(id) > 0) {
                <a
                  [routerLink]="['/legal', id, 'diff', previousVersion(id), entry.currentVersion]"
                  target="_blank"
                  class="text-slate-500 hover:underline"
                >
                  See exactly what changed
                </a>
              }
            </div>
          </li>
        }
      </ul>

      <label class="mt-6 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox checkbox-primary mt-0.5 shrink-0"
          [checked]="confirmed()"
          (change)="confirmed.set(!confirmed())"
        />
        <span class="text-sm leading-relaxed text-slate-700">
          I have read and accept the updated
          {{ outstanding().length === 1 ? 'document' : 'documents' }} above.
        </span>
      </label>

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!confirmed()"
          (click)="accept()"
        >
          Accept and continue
        </button>
        <!--
          A real way out. "Accept or you cannot use the product" is the reality
          of a terms update, but the person is entitled to leave instead, and
          hiding that makes the acceptance look less freely given than it is.
        -->
        <a routerLink="/settings" class="text-sm text-slate-500 hover:underline">
          Not now — take me to my settings
        </a>
      </div>
    } @else {
      <p class="mt-3 text-slate-600">You are up to date. Nothing to accept.</p>
      <a routerLink="/dashboard" class="btn btn-primary mt-6">Back to Habiti</a>
    }
  `
})
export class LegalAcceptPage {
  private consent = inject(ConsentService);
  private router = inject(Router);

  protected readonly index = LEGAL_INDEX;
  protected readonly confirmed = signal(false);

  /**
   * Snapshotted on load rather than read live.
   *
   * accept() writes records, which changes the service's `outstanding` — a live
   * binding would empty the list mid-interaction and the page would rearrange
   * itself under the user's cursor as they clicked.
   */
  private readonly initial = signal<LegalDocumentId[]>(this.consent.outstanding());
  protected readonly outstanding = computed(() => this.initial());

  /** 0 when there is no earlier version, so the diff link is hidden. */
  protected previousVersion(id: LegalDocumentId): number {
    const accepted = this.consent.acceptedVersion(id);
    return accepted > 0 ? accepted : 0;
  }

  protected accept(): void {
    if (!this.confirmed()) return;
    for (const id of this.outstanding()) {
      this.consent.acceptDocument(id, 'reacceptance_gate');
    }
    void this.router.navigate(['/dashboard']);
  }
}
