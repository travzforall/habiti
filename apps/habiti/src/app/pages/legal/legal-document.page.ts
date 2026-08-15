import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { LegalDocumentViewComponent } from './legal-document-view.component';
import { currentDocument, documentVersion, versionsOf } from '../../config/legal/documents';
import { LEGAL_DOCUMENT_ORDER, legalRoute } from '../../config/legal/registry';
import { LegalDocumentId } from '../../config/legal/types';

/**
 * One legal document, either the version in force or a pinned older one.
 *
 * THIS is the component that imports the prose, and it is reached only through
 * a lazy route — which is what keeps all seven documents out of the initial
 * bundle. Nothing eager may import from ../../config/legal/documents.
 */
@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [RouterLink, LegalDocumentViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mb-6 text-sm">
      <a routerLink="/legal" class="text-blue-600 hover:underline">← All legal documents</a>
    </nav>

    @if (document(); as doc) {
      @if (isPinned()) {
        <div
          class="mb-6 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700"
          role="note"
        >
          You are reading version {{ doc.version }}, which is
          {{ doc.version === currentVersion() ? 'the version in force' : 'no longer in force' }}.
          @if (doc.version !== currentVersion()) {
            <a [routerLink]="route(docId()!)" class="font-medium text-blue-600 hover:underline">
              Read the current version
            </a>
          }
        </div>
      }

      <app-legal-document-view [document]="doc" />

      @if (history().length > 1) {
        <section class="mt-10 border-t border-slate-200 pt-6">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Previous versions
          </h2>
          <ul class="mt-3 space-y-2 text-sm">
            @for (version of history(); track version.version) {
              <li>
                <a
                  [routerLink]="route(version.id, version.version)"
                  class="text-blue-600 hover:underline"
                >
                  Version {{ version.version }} — effective {{ version.effectiveFrom }}
                </a>
                @if (version.version > 1) {
                  <a
                    [routerLink]="['/legal', version.id, 'diff', version.version - 1, version.version]"
                    class="ml-3 text-slate-500 hover:underline"
                  >
                    see what changed
                  </a>
                }
              </li>
            }
          </ul>
        </section>
      }
    } @else {
      <h1 class="text-2xl font-bold text-slate-900">Not found</h1>
      <p class="mt-2 text-slate-600">
        There is no such document or version.
        <a routerLink="/legal" class="text-blue-600 hover:underline">See all legal documents</a>.
      </p>
    }
  `
})
export class LegalDocumentPage {
  private route$ = inject(ActivatedRoute);
  protected readonly route = legalRoute;

  private params = toSignal(this.route$.paramMap.pipe(map(p => ({
    docId: p.get('docId'),
    version: p.get('version')
  }))), { initialValue: { docId: null as string | null, version: null as string | null } });

  /** Null for an id that is not a real document — the template shows "not found". */
  protected readonly docId = computed<LegalDocumentId | null>(() => {
    const id = this.params().docId;
    return LEGAL_DOCUMENT_ORDER.includes(id as LegalDocumentId) ? (id as LegalDocumentId) : null;
  });

  protected readonly isPinned = computed(() => this.params().version !== null);

  protected readonly document = computed(() => {
    const id = this.docId();
    if (!id) return undefined;
    const version = this.params().version;
    return version === null ? currentDocument(id) : documentVersion(id, Number(version));
  });

  protected readonly currentVersion = computed(() => {
    const id = this.docId();
    return id ? currentDocument(id)?.version : undefined;
  });

  /** Oldest first, so the list reads as a history. */
  protected readonly history = computed(() => {
    const id = this.docId();
    return id ? versionsOf(id) : [];
  });
}
