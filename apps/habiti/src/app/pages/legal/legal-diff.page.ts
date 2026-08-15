import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { documentVersion } from '../../config/legal/documents';
import { LEGAL_DOCUMENT_ORDER } from '../../config/legal/registry';
import { LegalBlock, LegalDocumentId } from '../../config/legal/types';

type DiffState = 'added' | 'removed' | 'changed' | 'unchanged';
interface DiffRow {
  id: string;
  state: DiffState;
  before?: string;
  after?: string;
}

/**
 * What changed between two versions of a document.
 *
 * campaign_rule_versions requires the same thing of campaign rules: "the
 * campaign-rules-diff UI renders version N-1 against version N so nobody
 * accepts changed terms blind." Asking someone to re-accept without showing
 * them what moved is asking them to agree to something unread.
 *
 * A BLOCK-level comparison, not a text diff — which is the strongest practical
 * argument for storing documents as structured data. Every block carries a
 * stable id, so a paragraph that moved is recognised as the same paragraph, and
 * one whose wording changed shows both versions side by side. A markdown file
 * would only support a line diff, which reads as noise the moment a paragraph
 * is re-wrapped.
 */
@Component({
  selector: 'app-legal-diff',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mb-6 text-sm">
      <a routerLink="/legal" class="text-blue-600 hover:underline">← All legal documents</a>
    </nav>

    @if (valid()) {
      <h1 class="text-2xl font-bold text-slate-900">
        What changed in version {{ toVersion() }}
      </h1>
      <p class="mt-2 text-slate-600">
        Comparing version {{ fromVersion() }} with version {{ toVersion() }}.
      </p>
      @if (summary()) {
        <p class="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{{ summary() }}</p>
      }

      @if (changes().length === 0) {
        <p class="mt-8 rounded-xl border border-slate-200 p-4 text-slate-600">
          Nothing changed in the text between these versions.
        </p>
      } @else {
        <ol class="mt-8 space-y-4">
          @for (row of changes(); track row.id) {
            <li class="rounded-2xl border border-slate-200 p-4">
              <span
                class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                [class]="badge(row.state)"
              >
                {{ row.state }}
              </span>

              @if (row.before) {
                <p class="mt-3 text-sm text-slate-500 line-through decoration-rose-400">
                  {{ row.before }}
                </p>
              }
              @if (row.after) {
                <p class="mt-2 text-sm text-slate-800">{{ row.after }}</p>
              }
            </li>
          }
        </ol>
      }

      <p class="mt-8 text-sm">
        <a [routerLink]="['/legal', docId()]" class="text-blue-600 hover:underline">
          Read the current version in full
        </a>
      </p>
    } @else {
      <h1 class="text-2xl font-bold text-slate-900">Not found</h1>
      <p class="mt-2 text-slate-600">
        One of those versions does not exist.
        <a routerLink="/legal" class="text-blue-600 hover:underline">See all legal documents</a>.
      </p>
    }
  `
})
export class LegalDiffPage {
  private route = inject(ActivatedRoute);

  private params = toSignal(
    this.route.paramMap.pipe(
      map(p => ({ docId: p.get('docId'), from: Number(p.get('from')), to: Number(p.get('to')) }))
    ),
    { initialValue: { docId: null as string | null, from: NaN, to: NaN } }
  );

  protected readonly docId = computed<LegalDocumentId | null>(() => {
    const id = this.params().docId;
    return LEGAL_DOCUMENT_ORDER.includes(id as LegalDocumentId) ? (id as LegalDocumentId) : null;
  });

  protected readonly fromVersion = computed(() => this.params().from);
  protected readonly toVersion = computed(() => this.params().to);

  private readonly before = computed(() => {
    const id = this.docId();
    return id ? documentVersion(id, this.fromVersion()) : undefined;
  });
  private readonly after = computed(() => {
    const id = this.docId();
    return id ? documentVersion(id, this.toVersion()) : undefined;
  });

  protected readonly valid = computed(() => !!this.before() && !!this.after());
  protected readonly summary = computed(() => this.after()?.changeSummary ?? '');

  /** Only rows that actually differ — an unchanged document should read as empty. */
  protected readonly changes = computed<DiffRow[]>(() => {
    const before = this.before();
    const after = this.after();
    if (!before || !after) return [];

    const beforeById = new Map(before.blocks.map(b => [b.id, b]));
    const afterById = new Map(after.blocks.map(b => [b.id, b]));
    const rows: DiffRow[] = [];

    // Walk the NEW document first so the order reads like the new document.
    for (const block of after.blocks) {
      const old = beforeById.get(block.id);
      if (!old) {
        rows.push({ id: block.id, state: 'added', after: text(block) });
      } else if (text(old) !== text(block)) {
        rows.push({ id: block.id, state: 'changed', before: text(old), after: text(block) });
      }
    }
    for (const block of before.blocks) {
      if (!afterById.has(block.id)) {
        rows.push({ id: block.id, state: 'removed', before: text(block) });
      }
    }
    return rows;
  });

  protected badge(state: DiffState): string {
    if (state === 'added') return 'bg-emerald-100 text-emerald-800';
    if (state === 'removed') return 'bg-rose-100 text-rose-800';
    return 'bg-amber-100 text-amber-800';
  }
}

/** Flattens a block to comparable text. Same shape as the spec's helper. */
function text(block: LegalBlock): string {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
    case 'callout':
      return block.text;
    case 'list':
      return block.items.join('\n');
    case 'definitionList':
      return block.items.map(i => `${i.term}: ${i.description}`).join('\n');
    case 'review':
      return `${block.question} ${block.context ?? ''}`;
  }
}
