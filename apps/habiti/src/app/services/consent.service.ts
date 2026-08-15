import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { environment } from '../../environments/environment';
import { LEGAL_INDEX } from '../config/legal/registry';
import { LegalDocumentId, REQUIRED_DOCUMENT_IDS } from '../config/legal/types';
import {
  ConsentKind,
  ConsentRecord,
  ConsentRow,
  ConsentSurface,
  SensitiveCategory,
  fromConsentRow,
  isLive,
  newConsentId,
  toConsentRow
} from '../models/consent.models';

const STORAGE_KEY = 'habiti_consents';
const APP_VERSION = '1.0.0';

/**
 * Where a sign-up acceptance waits for an account to attach itself to.
 *
 * Registration ticks the box and then navigates to /login — there is no session
 * and therefore no user id at the moment of agreement. Without this the choice
 * would be to lose the record, or to ask the same person to accept again
 * seconds later, which teaches people that these prompts are noise.
 *
 * NOT namespaced by UserStorage, deliberately: at write time there is no user
 * to namespace by. The email is stored so it can only ever be adopted by the
 * account it was actually given for — the alternative, adopting on the next
 * sign-in whoever that is, is the same bleed UserStorage was written to stop.
 */
const PENDING_KEY = 'habiti_pending_acceptance';

interface PendingAcceptance {
  email: string;
  at: string;
  documents: { id: LegalDocumentId; version: number; contentHash: string }[];
}

/**
 * What the user has agreed to.
 *
 * Local-first with write-through, the same shape as SkillsService and
 * TasksService: the record is written to storage immediately so the UI can move
 * on, and pushed to Baserow when a table id exists.
 *
 * ── WHAT THIS CAN AND CANNOT PROVE ───────────────────────────────────────
 * The Baserow token ships in the client bundle, so a row written from here is
 * forgeable — by the user, and by anyone else, for anyone. So:
 *
 *   Provable today:     what each document SAID, and from when. Git history,
 *                       the deploy record, and a content hash under code review.
 *   Not provable today: that a particular person accepted it.
 *
 * That gap is small for terms acceptance — the sign-up flow is itself evidence
 * that a contract was formed — and large for Article 9 explicit consent, where
 * demonstrating consent is the obligation itself. It closes when the API writes
 * these rows, which is why every record carries `writtenBy`.
 *
 * The privacy policy must NOT claim auditable consent records until then.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private storage = inject(UserStorage);

  private readonly _records = signal<ConsentRecord[]>([]);
  readonly records = this._records.asReadonly();

  /**
   * Whether the server has actually answered.
   *
   * BaserowService.skip() emits an empty result rather than throwing when the
   * table id is 0, and an empty result is byte-identical to "this user has
   * consented to nothing". Concluding the second from the first would re-prompt
   * every user on every load — the trap 26-user-onboarding.json documents.
   * While this is false, only local state is trusted.
   */
  private readonly _loaded = signal(false);
  private warnedUnconfigured = false;

  constructor() {
    this.reload();
  }

  private get tableId(): number {
    return environment.baserow.tables.legalAcceptances ?? 0;
  }

  private get userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id === undefined || id === null ? null : String(id);
  }

  // --- reading -------------------------------------------------------------

  /** Live (accepted, not withdrawn) records only. */
  readonly live = computed(() => this._records().filter(isLive));

  /** The highest version of a document this user has accepted, or 0. */
  acceptedVersion(id: LegalDocumentId): number {
    return this.live()
      .filter(r => r.kind === 'document_acceptance' && r.documentId === id)
      .reduce((highest, r) => Math.max(highest, r.documentVersion ?? 0), 0);
  }

  /**
   * Documents this user still owes an acceptance for.
   *
   * A floor, not a reset: `requiresAcceptanceFrom` rises only on a material
   * change, so correcting a typo does not re-prompt everyone. Re-prompting for
   * trivia is how users learn to click through the one that matters.
   */
  readonly outstanding = computed<LegalDocumentId[]>(() =>
    REQUIRED_DOCUMENT_IDS.filter(
      id => this.acceptedVersion(id) < LEGAL_INDEX[id].requiresAcceptanceFrom
    )
  );

  readonly needsAcceptance = computed(() => this.outstanding().length > 0);

  /** Whether Article 9 consent is live for a category. */
  hasSensitiveConsent(category: SensitiveCategory): boolean {
    return this.live().some(r => r.kind === 'special_category' && r.scope === category);
  }

  /** Whether the user consented to share sensitive check-ins in one campaign. */
  hasShareConsent(campaignKey: string): boolean {
    return this.live().some(r => r.kind === 'campaign_share' && r.scope === campaignKey);
  }

  /** Live Article 9 consents, for the Settings list. */
  readonly sensitiveConsents = computed(() =>
    this.live().filter(r => r.kind === 'special_category')
  );

  // --- writing -------------------------------------------------------------

  /**
   * Remembers that someone accepted at sign-up, before they had an account.
   *
   * Called by the registration page after a successful sign-up. Nothing is
   * written to Baserow here — there is no user id to write it against.
   */
  stashSignupAcceptance(email: string): void {
    const pending: PendingAcceptance = {
      email: email.trim().toLowerCase(),
      at: new Date().toISOString(),
      documents: REQUIRED_DOCUMENT_IDS.map(id => ({
        id,
        version: LEGAL_INDEX[id].currentVersion,
        contentHash: LEGAL_INDEX[id].contentHash
      }))
    };
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      // Private mode or a full quota. The acceptance still happened; it just
      // will not be recorded, and the gate will ask again on first sign-in.
    }
  }

  /**
   * Turns a stashed sign-up acceptance into real records, once we know who it was.
   *
   * Adopts ONLY when the email matches the account signing in. A mismatch means
   * someone else is using this browser, and their agreement is not this
   * person's — the stash is dropped rather than reassigned.
   */
  adoptSignupAcceptance(email: string | undefined): void {
    let pending: PendingAcceptance | null = null;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      pending = raw ? (JSON.parse(raw) as PendingAcceptance) : null;
    } catch {
      pending = null;
    }
    if (!pending) return;

    localStorage.removeItem(PENDING_KEY);
    if (!email || pending.email !== email.trim().toLowerCase()) return;

    for (const doc of pending.documents) {
      // Skip anything already on file — signing in twice must not double-record.
      if (this.acceptedVersion(doc.id) >= doc.version) continue;
      this.record({
        kind: 'document_acceptance',
        documentId: doc.id,
        documentVersion: doc.version,
        contentHash: doc.contentHash,
        accepted: true,
        surface: 'registration',
        acceptedAt: pending.at
      });
    }
  }

  /** Records acceptance of the CURRENT version of a document. */
  acceptDocument(id: LegalDocumentId, surface: ConsentSurface): ConsentRecord {
    const entry = LEGAL_INDEX[id];
    return this.record({
      kind: 'document_acceptance',
      documentId: id,
      documentVersion: entry.currentVersion,
      contentHash: entry.contentHash,
      accepted: true,
      surface
    });
  }

  /** Article 9(2)(a) explicit consent, or a refusal. */
  recordSensitiveConsent(
    category: SensitiveCategory,
    accepted: boolean,
    surface: ConsentSurface
  ): ConsentRecord {
    return this.record({ kind: 'special_category', scope: category, accepted, surface });
  }

  /** Consent to show sensitive check-ins to the other people in one campaign. */
  recordShareConsent(campaignKey: string, accepted: boolean): ConsentRecord {
    return this.record({
      kind: 'campaign_share',
      scope: campaignKey,
      accepted,
      surface: 'campaign_join'
    });
  }

  /**
   * Withdraws every live consent of a kind and scope.
   *
   * Stamps `withdrawnAt` rather than deleting: withdrawal is itself a fact the
   * controller must be able to show (Article 7(3)), and a deleted row shows
   * nothing. This is the ONLY update ever made to an existing record.
   */
  withdraw(kind: ConsentKind, scope: string): void {
    const now = new Date().toISOString();
    const affected = this.live().filter(r => r.kind === kind && r.scope === scope);
    if (affected.length === 0) return;

    this._records.update(all =>
      all.map(r => (affected.some(a => a.id === r.id) ? { ...r, withdrawnAt: now } : r))
    );
    this.persist();

    for (const record of affected) {
      if (record.rowId && this.tableId) {
        this.baserow
          .updateRow<ConsentRow>(this.tableId, record.rowId, { withdrawn_at: now })
          .subscribe({ error: err => console.warn('ConsentService: withdrawal not synced.', err) });
      }
    }
  }

  private record(
    input: Pick<ConsentRecord, 'kind' | 'accepted' | 'surface'> &
      Partial<
        Pick<
          ConsentRecord,
          'documentId' | 'documentVersion' | 'contentHash' | 'scope' | 'acceptedAt'
        >
      >
  ): ConsentRecord {
    const userId = this.userId;
    const created: ConsentRecord = {
      id: newConsentId(),
      userId: userId ?? 'guest',
      // An adopted sign-up acceptance carries the time it was actually given,
      // not the time it was adopted.
      acceptedAt: input.acceptedAt ?? new Date().toISOString(),
      writtenBy: 'client',
      ...input
    };

    this._records.update(all => [...all, created]);
    this.persist();

    // A consent given before sign-in has nobody to belong to. It stays local so
    // the UI is consistent, and is not pushed — a row under 'guest' would be
    // worse than no row.
    if (!userId) return created;

    if (!this.tableId) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        console.warn(
          'ConsentService: legalAcceptances table id is 0 — consents are recorded ' +
            'locally only. Create it with: node scripts/create-baserow-table.mjs ' +
            '30-legal-acceptances.json --apply'
        );
      }
      return created;
    }

    this.baserow.createRow<ConsentRow>(this.tableId, toConsentRow(created, APP_VERSION)).subscribe({
      next: row => {
        // Adopt the server id so a later withdrawal can find the row.
        if (row?.id) {
          this._records.update(all =>
            all.map(r => (r.id === created.id ? { ...r, rowId: row.id } : r))
          );
          this.persist();
        }
      },
      error: err => console.warn('ConsentService: consent not synced.', err)
    });

    return created;
  }

  // --- persistence ---------------------------------------------------------

  /**
   * Re-reads for whoever is signed in now. Called by SyncService on account switch.
   *
   * Also the moment a sign-up acceptance finally has an account to belong to,
   * which is why adoption happens here rather than in the login page: this runs
   * on every account change, however the user got there.
   */
  reload(): void {
    this._records.set(this.storage.read<ConsentRecord[]>(STORAGE_KEY, []));
    this._loaded.set(false);
    this.adoptSignupAcceptance(this.auth.currentUserValue?.email);
    this.loadFromServer();
  }

  private persist(): void {
    this.storage.write(STORAGE_KEY, this._records());
  }

  private loadFromServer(): void {
    const userId = this.userId;
    if (!userId || !this.tableId) return;

    this.baserow
      .listAllRows<ConsentRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const server = rows.map(fromConsentRow);
          // Local records not yet pushed must survive a load, or a consent given
          // seconds ago disappears from the UI when the fetch lands.
          const unsynced = this._records().filter(r => !r.rowId);
          this._records.set([...server, ...unsynced]);
          this._loaded.set(true);
          this.persist();
        },
        error: err => console.warn('ConsentService: using locally stored consents.', err)
      });
  }
}
