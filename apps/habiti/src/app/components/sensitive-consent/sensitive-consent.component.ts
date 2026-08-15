import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SENSITIVE_CATEGORY_COPY } from '../../config/sensitive-habits';
import { SensitiveCategory } from '../../models/consent.models';

/**
 * Explicit consent for Article 9 data, asked at the moment it is needed.
 *
 * Modelled on the pledge disclaimer in challenges.html — "the honest
 * disclaimer, in-product rather than buried in terms" — which is the right
 * pattern: blunt, at the point of decision, and gating.
 *
 * WHY THIS IS NOT A LINE IN THE TERMS. Article 9(2)(a) consent must be
 * explicit, specific, informed and SEPARATE. Bundled into the sign-up checkbox
 * it would not be consent at all, and the data would have no lawful basis.
 *
 * WHY THE REFUSAL PATH IS REAL. Consent is only valid if it is freely given,
 * which means declining has to be a genuine option rather than a dead end.
 * Declining here creates nothing and breaks nothing: the rest of the app works
 * exactly as before and the user can track anything else. The modal says so
 * out loud, because a refusal option nobody believes in is not one.
 *
 * One checkbox PER CATEGORY. Someone adding a prayer habit and a recovery habit
 * together is being asked two different questions, and a single "I agree" would
 * collapse them into one they never actually answered.
 */
@Component({
  selector: 'app-sensitive-consent',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (categories().length > 0) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitive-consent-title"
      >
        <!-- No click-to-dismiss on the backdrop: this is a decision, not a peek. -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>

        <div
          class="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-w-lg dark:bg-slate-800"
        >
          <div class="shrink-0 bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 text-white">
            <h2 id="sensitive-consent-title" class="text-lg font-bold">Before we save this</h2>
            <p class="mt-1 text-sm text-white/85">
              {{
                categories().length === 1
                  ? 'This habit records something the law treats as sensitive.'
                  : 'These habits record things the law treats as sensitive.'
              }}
            </p>
          </div>

          <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            @for (category of categories(); track category) {
              @let copy = text[category];
              <label
                class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors"
                [class]="
                  agreed().has(category)
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                "
              >
                <input
                  type="checkbox"
                  class="mt-1 h-5 w-5 shrink-0 rounded accent-blue-600"
                  [checked]="agreed().has(category)"
                  (change)="toggle(category)"
                />
                <span class="min-w-0">
                  <span class="block font-medium text-slate-800 dark:text-slate-100">
                    {{ copy.icon }} {{ copy.label }}
                  </span>
                  <span class="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                    Habiti will store {{ copy.stores }}.
                  </span>
                </span>
              </label>
            }

            <!--
              The honest bit. While the Baserow token ships in the client
              bundle, access between accounts is not enforced by a server, and
              a consent screen that implied otherwise would be misleading at
              exactly the moment the user is deciding to trust us.
            -->
            <p class="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              This is stored on our database server. We are still tightening who can technically
              reach it — our
              <a routerLink="/trust" target="_blank" class="font-semibold underline">Trust page</a>
              explains exactly where that stands.
            </p>

            <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              You can withdraw this later in Settings, and we will offer to delete the habits it
              covers. Declining is fine — {{ declineConsequence() }} Nothing else changes.
            </p>
          </div>

          <div
            class="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-700"
          >
            <button
              type="button"
              (click)="declined.emit()"
              class="rounded-xl px-4 py-2.5 font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              No thanks
            </button>
            <button
              type="button"
              (click)="confirm()"
              [disabled]="!allAgreed()"
              class="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              {{ allAgreed() ? 'Agree and add' : 'Tick to continue' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SensitiveConsentComponent {
  /** Empty closes the dialog — the parent owns "which categories, if any". */
  readonly categories = input<SensitiveCategory[]>([]);

  /** Emits the categories consented to, in the same order they were asked. */
  readonly accepted = output<SensitiveCategory[]>();
  readonly declined = output<void>();

  protected readonly text = SENSITIVE_CATEGORY_COPY;
  protected readonly agreed = signal(new Set<SensitiveCategory>());

  /** Every category must be ticked — one blanket agreement is not consent to four things. */
  protected readonly allAgreed = computed(
    () => this.categories().length > 0 && this.agreed().size === this.categories().length
  );

  protected readonly declineConsequence = computed(() =>
    this.categories().length === 1
      ? 'the habit just is not added.'
      : 'those habits just are not added.'
  );

  constructor() {
    document.body.style.overflow = 'hidden';
    // Closing by navigation must not leave the page permanently unscrollable.
    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  protected toggle(category: SensitiveCategory): void {
    this.agreed.update(current => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  protected confirm(): void {
    if (!this.allAgreed()) return;
    document.body.style.overflow = '';
    this.accepted.emit(this.categories());
  }
}
