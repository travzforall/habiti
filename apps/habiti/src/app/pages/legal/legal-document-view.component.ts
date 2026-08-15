import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LegalBlock, LegalDocument } from '../../config/legal/types';

/**
 * Renders a legal document.
 *
 * Every block goes through Angular interpolation. There is no innerHTML and no
 * sanitiser anywhere in this app, and this feature deliberately does not
 * introduce the first one: the documents are static, code-reviewed data, so
 * markdown would buy authoring convenience at the cost of an injection surface.
 *
 * `review` blocks render VISIBLY, as amber panels. They are questions for the
 * reviewing lawyer, and the point is that someone reading the draft in a
 * browser sees exactly what is unresolved rather than having to diff the source.
 * A document cannot be marked `published` while it still has one —
 * legal-documents.spec.ts enforces that.
 */
@Component({
  selector: 'app-legal-document-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let doc = document();

    <article class="prose-legal">
      <header class="mb-8 border-b border-slate-200 pb-6">
        <h1 class="text-3xl font-bold text-slate-900">{{ doc.title }}</h1>
        <p class="mt-2 text-slate-600">{{ doc.summary }}</p>

        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          <span>Version {{ doc.version }}</span>
          <span aria-hidden="true">·</span>
          <span>Effective {{ doc.effectiveFrom }}</span>
          @if (doc.status === 'draft') {
            <span
              class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800"
            >
              Draft — not in force
            </span>
          }
        </div>

        @if (doc.changeSummary) {
          <p class="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            <span class="font-semibold">What changed:</span> {{ doc.changeSummary }}
          </p>
        }
      </header>

      @if (doc.status === 'draft') {
        <div
          class="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="note"
        >
          <p class="font-semibold">This is a draft.</p>
          <p class="mt-1">
            It has not been reviewed by a lawyer and it is not in force. It is published here so it
            can be read and corrected. The amber panels below are the open questions.
          </p>
        </div>
      }

      @for (block of doc.blocks; track block.id) {
        <div [id]="block.id" class="scroll-mt-24">
          @switch (block.kind) {
            @case ('heading') {
              <h2 class="mt-8 mb-3 text-xl font-bold text-slate-900">{{ asHeading(block).text }}</h2>
            }
            @case ('paragraph') {
              <p class="mb-4 leading-relaxed text-slate-700">{{ asParagraph(block).text }}</p>
            }
            @case ('list') {
              @let list = asList(block);
              @if (list.ordered) {
                <ol class="mb-4 list-decimal space-y-2 pl-6 text-slate-700">
                  @for (item of list.items; track item) {
                    <li>{{ item }}</li>
                  }
                </ol>
              } @else {
                <ul class="mb-4 list-disc space-y-2 pl-6 text-slate-700">
                  @for (item of list.items; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
            }
            @case ('definitionList') {
              <dl class="mb-4 space-y-3">
                @for (item of asDefinitionList(block).items; track item.term) {
                  <div class="rounded-xl bg-slate-50 p-4">
                    <dt class="font-semibold text-slate-900">{{ item.term }}</dt>
                    <dd class="mt-1 text-slate-700">{{ item.description }}</dd>
                  </div>
                }
              </dl>
            }
            @case ('callout') {
              @let callout = asCallout(block);
              <aside
                class="mb-5 rounded-xl border-l-4 p-4"
                [class]="
                  callout.tone === 'warning'
                    ? 'border-rose-400 bg-rose-50 text-rose-900'
                    : 'border-blue-400 bg-blue-50 text-blue-900'
                "
                role="note"
              >
                {{ callout.text }}
              </aside>
            }
            @case ('review') {
              @let review = asReview(block);
              <aside
                class="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
                role="note"
              >
                <p class="text-xs font-bold uppercase tracking-wide">Open question for review</p>
                <p class="mt-1 font-semibold">{{ review.question }}</p>
                @if (review.context) {
                  <p class="mt-2 text-sm">{{ review.context }}</p>
                }
              </aside>
            }
          }
        </div>
      }
    </article>
  `
})
export class LegalDocumentViewComponent {
  readonly document = input.required<LegalDocument>();

  /**
   * Narrowing helpers.
   *
   * `@switch` on a discriminated union does not narrow the loop variable in a
   * template the way it would in TypeScript, so each case asserts the shape it
   * has already matched on. Tedious, and still better than widening LegalBlock
   * to something that would let a case render the wrong fields silently.
   */
  protected asHeading(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'heading' }>;
  }
  protected asParagraph(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'paragraph' }>;
  }
  protected asList(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'list' }>;
  }
  protected asDefinitionList(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'definitionList' }>;
  }
  protected asCallout(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'callout' }>;
  }
  protected asReview(b: LegalBlock) {
    return b as Extract<LegalBlock, { kind: 'review' }>;
  }
}
