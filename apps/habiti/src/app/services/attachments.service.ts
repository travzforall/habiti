import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { SubscriptionService } from './subscription.service';
import { ResettableRegistry } from './resettable.registry';
import { Attachment } from '../models/project.model';
import { AttachmentRow, fromAttachment, toAttachment } from '../models/attachment-row.models';
import { QUOTA_BYTES } from '../config/attachment-limits';
// TYPE-ONLY, deliberately: a value import here would pull the upload service
// (and its canvas and HttpClient code) into the eager bundle. See the note at
// the top of config/attachment-limits.ts.
import type { UploadedFile } from './attachment-upload.service';

/**
 * What is attached to which task or project.
 *
 * The FILES are in Baserow's storage (AttachmentUploadService put them there);
 * this service owns the records that say a file belongs to something.
 *
 * ── "DELETE" MEANS DETACH, AND THE UI SAYS SO ─────────────────────────────
 *
 * Removing an attachment deletes this row. It does NOT delete the stored file:
 * a Baserow database token can upload but cannot delete user files, and the URL
 * stays live and public afterwards. Saying "deleted" while the file is still
 * fetchable would be a lie in a product that ships a Trust page, so the wording
 * everywhere is "remove", and `baserow_name` is kept on the row so a
 * server-side proxy can do the real thing later.
 *
 * While `tables.taskAttachments` is 0 the table does not exist yet and
 * everything here works from the local cache only — the same pattern
 * SkillsService and LevelService use. Uploads still succeed; the record of
 * which task they belong to just does not leave this browser.
 */

/** Namespaced per account by UserStorage, so one user's notice is not another's. */
const NOTICE_KEY = 'habiti_attachment_notice';

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private readonly STORAGE_KEY = 'habiti_attachments';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);
  private subscription = inject(SubscriptionService);
  private registry = inject(ResettableRegistry);

  private _attachments = signal<Attachment[]>([]);
  public readonly attachments = this._attachments.asReadonly();

  private warned = false;

  private get tableId(): number {
    return this.baserow.tables?.taskAttachments ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  constructor() {
    this.loadCache();
    // Lazily constructed, so this cannot run before the feature loads — which
    // is the point. See resettable.registry.ts.
    this.registry.register(this, ['tasks']);
  }

  // --- the first-upload notice ---------------------------------------------

  /**
   * Has this account been told where its files go?
   *
   * A NOTICE, not a consent record. The lawful basis for storing a file someone
   * deliberately attaches to their own task is the contract, not consent — so
   * dressing this up as a consent tick would misrepresent it, and ConsentService
   * is for the things that genuinely are consent (Article 9 categories, sharing
   * with other people). What is owed here is transparency, and what has to be
   * remembered is only "we have said this once", which lives in local storage.
   */
  hasSeenNotice(): boolean {
    return this.storage.readRaw(NOTICE_KEY) === 'seen';
  }

  markNoticeSeen(): void {
    this.storage.writeRaw(NOTICE_KEY, 'seen');
  }

  // --- reads ---------------------------------------------------------------

  forParent(parentType: 'task' | 'project', parentId: string): Attachment[] {
    return this._attachments()
      .filter(a => a.parentType === parentType && a.parentId === parentId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  /** Bytes this account is using, across every attachment it has. */
  public readonly usedBytes = computed(() =>
    this._attachments().reduce((sum, a) => sum + (a.size ?? 0), 0)
  );

  public readonly quotaBytes = computed(() =>
    this.subscription.isPaid() ? QUOTA_BYTES.plus : QUOTA_BYTES.free
  );

  public readonly quotaRemaining = computed(() =>
    Math.max(0, this.quotaBytes() - this.usedBytes())
  );

  /** True when this file would not fit. Checked BEFORE the upload starts. */
  wouldExceedQuota(bytes: number): boolean {
    return bytes > this.quotaRemaining();
  }

  // --- writes --------------------------------------------------------------

  /** Records an uploaded file against a task or project. */
  add(
    parentType: 'task' | 'project',
    parentId: string,
    uploaded: UploadedFile,
    kind: Attachment['kind']
  ): Attachment {
    const attachment: Attachment = {
      id: this.generateId(),
      parentType,
      parentId,
      kind,
      filename: uploaded.originalName || uploaded.name,
      url: uploaded.url,
      thumbnailUrl: uploaded.thumbnailUrl,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      width: uploaded.width,
      height: uploaded.height,
      baserowName: uploaded.name,
      uploadedAt: new Date()
    };

    this._attachments.update(list => [...list, attachment]);
    this.saveCache();
    this.persist(attachment);
    return attachment;
  }

  /** Attaches a link — a document living somewhere else, kept next to the files. */
  addLink(parentType: 'task' | 'project', parentId: string, url: string, title?: string): Attachment {
    const attachment: Attachment = {
      id: this.generateId(),
      parentType,
      parentId,
      kind: 'link',
      filename: title?.trim() || hostOf(url),
      url,
      size: 0,
      uploadedAt: new Date()
    };

    this._attachments.update(list => [...list, attachment]);
    this.saveCache();
    this.persist(attachment);
    return attachment;
  }

  setCaption(attachmentId: string, caption: string): void {
    this._attachments.update(list =>
      list.map(a => (a.id === attachmentId ? { ...a, caption } : a))
    );
    this.saveCache();

    const updated = this._attachments().find(a => a.id === attachmentId);
    if (updated) this.persist(updated);
  }

  /**
   * Moves an attachment to a different owner.
   *
   * Needed when a task is promoted to a sub-project: the task stops existing,
   * and its photos and documents have to follow it rather than being left
   * pointing at a row that is gone — which is invisible, because the files
   * page only ever asks for one parent's rows.
   */
  reassign(attachmentId: string, parentType: 'task' | 'project', parentId: string): void {
    this._attachments.update(list =>
      list.map(a => (a.id === attachmentId ? { ...a, parentType, parentId } : a))
    );
    this.saveCache();

    const updated = this._attachments().find(a => a.id === attachmentId);
    if (updated) this.persist(updated);
  }

  /**
   * Removes the record. The stored file itself stays — see the note above.
   */
  remove(attachmentId: string): void {
    this._attachments.update(list => list.filter(a => a.id !== attachmentId));
    this.saveCache();

    const rowId = Number(attachmentId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      next: () => this.syncBus.touched('tasks'),
      error: err => console.warn('AttachmentsService: row not deleted.', err)
    });
  }

  // --- persistence ---------------------------------------------------------

  /**
   * Loads the attachments for one parent.
   *
   * Per-parent rather than all-at-once: a detail page needs one task's files,
   * and an account with years of photos should not fetch every row to show
   * three.
   */
  loadForParent(parentType: 'task' | 'project', parentId: string): void {
    const userId = this.userId();
    if (!parentId || !userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }

    this.baserow
      .listAllRows<AttachmentRow>(this.tableId, {
        filters: [
          { field: 'user_id', op: 'equal', value: userId },
          { field: 'parent_type', op: 'equal', value: parentType },
          { field: 'parent_id', op: 'equal', value: parentId }
        ]
      })
      .subscribe({
        next: rows => {
          const fetched = (rows ?? []).map(toAttachment);
          this._attachments.update(list => [
            // Replace this parent's records wholesale; keep everything else.
            ...list.filter(a => !(a.parentType === parentType && a.parentId === parentId)),
            ...fetched
          ]);
          this.saveCache();
        },
        error: err => console.warn('AttachmentsService: could not load attachments.', err)
      });
  }

  /** Loads every attachment this account has — the quota needs the total. */
  loadAll(): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    this.baserow
      .listAllRows<AttachmentRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          this._attachments.set((rows ?? []).map(toAttachment));
          this.saveCache();
        },
        error: err => console.warn('AttachmentsService: could not load attachments.', err)
      });
  }

  private persist(attachment: Attachment): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }

    const data = fromAttachment(attachment, userId);
    const rowId = Number(attachment.id);

    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<AttachmentRow>(this.tableId, rowId, data)
      : this.baserow.createRow<AttachmentRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          this._attachments.update(list =>
            list.map(a => (a.id === attachment.id ? { ...a, id: String(row.id) } : a))
          );
          this.saveCache();
        }
        this.syncBus.touched('tasks');
      },
      error: err => console.warn('AttachmentsService: attachment not persisted.', err)
    });
  }

  reload(): void {
    this._attachments.set([]);
    this.loadCache();
    this.loadAll();
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'AttachmentsService: tables.taskAttachments is 0 — attachments stay on this browser. ' +
        'Create it with: node scripts/create-baserow-table.mjs 31-task-attachments.json --apply'
    );
  }

  private loadCache(): void {
    try {
      const raw = this.storage.readRaw(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Attachment[];
      this._attachments.set(
        parsed.map(a => ({ ...a, uploadedAt: new Date(a.uploadedAt) }))
      );
    } catch (error) {
      console.error('AttachmentsService: could not read the cache.', error);
      this._attachments.set([]);
    }
  }

  private saveCache(): void {
    try {
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(this._attachments()));
    } catch (error) {
      console.error('AttachmentsService: could not write the cache.', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
