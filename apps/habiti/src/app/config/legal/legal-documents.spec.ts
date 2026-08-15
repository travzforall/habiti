import { canonicalJson } from '@habiti/util';
import { LEGAL_DOCUMENT_ORDER, LEGAL_INDEX } from './registry';
import { LEGAL_DOCUMENT_VERSIONS, currentDocument, versionsOf } from './documents';
import { LegalBlock, LegalDocumentId, REQUIRED_DOCUMENT_IDS } from './types';

/**
 * A data spec, in the style of the habit and skill catalogue specs.
 *
 * Everything asserted here is invisible to a typecheck and expensive to get
 * wrong: a document whose hash no longer matches its text means every
 * acceptance record points at words nobody agreed to; a `published` document
 * still carrying a question for the lawyer means an unfinished draft is live;
 * a registry that has drifted from the prose it indexes means the app shows one
 * version and records another.
 */

/** Blocks that carry user-visible prose, for the substance checks below. */
function textOf(block: LegalBlock): string {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
    case 'callout':
      return block.text;
    case 'list':
      return block.items.join(' ');
    case 'definitionList':
      return block.items.map(i => `${i.term} ${i.description}`).join(' ');
    case 'review':
      return `${block.question} ${block.context ?? ''}`;
  }
}

describe('legal documents', () => {
  it('every document has the fields an acceptance record needs', () => {
    for (const doc of LEGAL_DOCUMENT_VERSIONS) {
      expect(doc.id).withContext('id').toBeTruthy();
      expect(doc.version).withContext(`${doc.id} version`).toBeGreaterThanOrEqual(1);
      expect(doc.title.trim()).withContext(`${doc.id} title`).not.toBe('');
      expect(doc.summary.trim()).withContext(`${doc.id} summary`).not.toBe('');
      expect(doc.blocks.length).withContext(`${doc.id} blocks`).toBeGreaterThan(0);
      expect(doc.effectiveFrom)
        .withContext(`${doc.id} effectiveFrom must be YYYY-MM-DD`)
        .toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(doc.effectiveFrom)))
        .withContext(`${doc.id} effectiveFrom must be a real date`)
        .toBe(false);
    }
  });

  /**
   * The load-bearing one.
   *
   * Editing a word without bumping the hash would leave every stored acceptance
   * pointing at text that no longer exists. `scripts/legal-hashes.mjs --write`
   * regenerates these; this fails the build if someone forgets.
   */
  it('the checked-in contentHash matches the blocks', async () => {
    for (const doc of LEGAL_DOCUMENT_VERSIONS) {
      const digest = await sha256(canonicalJson(doc.blocks));
      expect(doc.contentHash)
        .withContext(
          `${doc.id} v${doc.version}: content changed without its hash. ` +
            `Run: node scripts/legal-hashes.mjs --write`
        )
        .toBe(digest);
    }
  });

  it('versions of a document are unique and contiguous from 1', () => {
    for (const id of LEGAL_DOCUMENT_ORDER) {
      const numbers = versionsOf(id).map(d => d.version);
      expect(new Set(numbers).size).withContext(`${id} has duplicate versions`).toBe(numbers.length);
      expect(numbers).withContext(`${id} versions must start at 1 and not skip`).toEqual(
        numbers.map((_, i) => i + 1)
      );
    }
  });

  it('effective dates never go backwards across versions', () => {
    for (const id of LEGAL_DOCUMENT_ORDER) {
      const dates = versionsOf(id).map(d => d.effectiveFrom);
      expect(dates).withContext(`${id} effective dates out of order`).toEqual([...dates].sort());
    }
  });

  it('block ids are unique within a document', () => {
    for (const doc of LEGAL_DOCUMENT_VERSIONS) {
      const ids = doc.blocks.map(b => b.id);
      expect(ids.every(id => id.trim() !== ''))
        .withContext(`${doc.id} has a block with no id — the diff view needs one`)
        .toBe(true);
      expect(new Set(ids).size).withContext(`${doc.id} has duplicate block ids`).toBe(ids.length);
    }
  });

  describe('the draft/published gate', () => {
    it('a published document contains no unanswered review blocks', () => {
      for (const doc of LEGAL_DOCUMENT_VERSIONS.filter(d => d.status === 'published')) {
        const open = doc.blocks.filter(b => b.kind === 'review').map(b => b.id);
        expect(open)
          .withContext(`${doc.id} v${doc.version} is published with open questions: ${open}`)
          .toEqual([]);
      }
    });

    it('a published document contains no placeholder text', () => {
      const placeholders = /\b(TODO|TBD|UNKNOWN|FIXME|XXX|Lorem ipsum)\b/i;
      for (const doc of LEGAL_DOCUMENT_VERSIONS.filter(d => d.status === 'published')) {
        for (const block of doc.blocks) {
          expect(placeholders.test(textOf(block)))
            .withContext(`${doc.id} block "${block.id}" still has placeholder text`)
            .toBe(false);
        }
      }
    });

    it('a published document is not dated in the future', () => {
      const today = new Date().toISOString().slice(0, 10);
      for (const doc of LEGAL_DOCUMENT_VERSIONS.filter(d => d.status === 'published')) {
        expect(doc.effectiveFrom <= today)
          .withContext(`${doc.id} v${doc.version} is published but takes effect later`)
          .toBe(true);
      }
    });
  });

  describe('the registry', () => {
    it('indexes exactly the documents that exist', () => {
      const indexed = [...LEGAL_DOCUMENT_ORDER].sort();
      const authored = [...new Set(LEGAL_DOCUMENT_VERSIONS.map(d => d.id))].sort();
      expect(indexed).toEqual(authored);
      expect(Object.keys(LEGAL_INDEX).sort()).toEqual(authored);
    });

    it('has not drifted from the documents it points at', () => {
      for (const id of LEGAL_DOCUMENT_ORDER) {
        const doc = currentDocument(id);
        const entry = LEGAL_INDEX[id];
        expect(doc).withContext(`${id} is indexed but has no versions`).toBeDefined();
        if (!doc) continue;

        // The registry duplicates these so it can stay prose-free. Duplication
        // is only safe while something checks it.
        expect(entry.currentVersion).withContext(`${id} version`).toBe(doc.version);
        expect(entry.contentHash).withContext(`${id} hash`).toBe(doc.contentHash);
        expect(entry.effectiveFrom).withContext(`${id} effectiveFrom`).toBe(doc.effectiveFrom);
        expect(entry.status).withContext(`${id} status`).toBe(doc.status);
        expect(entry.title).withContext(`${id} title`).toBe(doc.title);
        expect(entry.summary).withContext(`${id} summary`).toBe(doc.summary);
      }
    });

    it('never demands acceptance of a version that does not exist', () => {
      for (const id of LEGAL_DOCUMENT_ORDER) {
        const entry = LEGAL_INDEX[id];
        expect(entry.requiresAcceptanceFrom)
          .withContext(`${id} requiresAcceptanceFrom is above the current version`)
          .toBeLessThanOrEqual(entry.currentVersion);
        expect(entry.requiresAcceptanceFrom).withContext(`${id}`).toBeGreaterThanOrEqual(1);
      }
    });

    it('only raises the acceptance floor to a version marked material', () => {
      for (const id of LEGAL_DOCUMENT_ORDER) {
        const floor = LEGAL_INDEX[id].requiresAcceptanceFrom;
        if (floor <= 1) continue;
        const doc = versionsOf(id).find(d => d.version === floor);
        expect(doc?.material)
          .withContext(
            `${id} forces re-acceptance from v${floor}, but that version is not marked material. ` +
              `Re-prompting users for an editorial change teaches them to click through the real ones.`
          )
          .toBe(true);
      }
    });

    it('every document a user must accept exists and is required', () => {
      for (const id of REQUIRED_DOCUMENT_IDS) {
        expect(currentDocument(id)).withContext(`${id} is required but missing`).toBeDefined();
      }
    });
  });

  describe('substance', () => {
    it('every version after the first says what changed', () => {
      for (const doc of LEGAL_DOCUMENT_VERSIONS.filter(d => d.version > 1)) {
        expect(doc.changeSummary.trim())
          .withContext(`${doc.id} v${doc.version} has no changeSummary — the diff view needs it`)
          .not.toBe('');
      }
    });

    it('no block is empty', () => {
      for (const doc of LEGAL_DOCUMENT_VERSIONS) {
        for (const block of doc.blocks) {
          expect(textOf(block).trim())
            .withContext(`${doc.id} block "${block.id}" is empty`)
            .not.toBe('');
        }
      }
    });

    it('the health disclaimer still disclaims medical advice and points at emergency help', () => {
      // A smoke test on substance, not proof of legal sufficiency. The app
      // recommends a thirty-day sobriety challenge and tracks medication
      // adherence, so an edit that quietly removes the disclaimer or the crisis
      // signpost is exactly the change that should fail a build.
      //
      // Matched loosely on purpose — asserting an exact sentence would fail on
      // any rewording, which trains people to delete the test.
      const text = currentDocument('health-disclaimer')!.blocks.map(textOf).join(' ').toLowerCase();
      expect(text).withContext('must disclaim being medical').toMatch(/not a medical|not medical/);
      expect(text).withContext('must disclaim giving advice').toContain('advice');
      expect(text).withContext('must point somewhere in a crisis').toContain('emergency');
    });

    it('the refunds policy states that Habiti never holds money', () => {
      // Must stay consistent with the in-product pledge disclaimer. A mismatch
      // between the two is what a complaint would seize on.
      const text = currentDocument('refunds')!.blocks.map(textOf).join(' ').toLowerCase();
      expect(text).toContain('never holds or transfers money');
    });
  });
});

/** Web Crypto — available in the browser Karma runs in. */
async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
