import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Attachment } from '../../models/project.model';
import { AttachmentsService } from '../../services/attachments.service';
import { AttachmentUploadService, UploadedFile } from '../../services/attachment-upload.service';
import { formatBytes } from '../../config/attachment-limits';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AttachmentNoticeComponent } from '../attachment-notice/attachment-notice.component';
import { ToastService } from '../../services/toast.service';

interface InFlight {
  name: string;
  percent: number;
  cancel: () => void;
}

/**
 * Attach files to a task or a project, and look at what is attached.
 *
 * ── WHAT THE UI HAS TO BE HONEST ABOUT ────────────────────────────────────
 *
 * Uploaded files sit at a public, unauthenticated URL, and removing one here
 * detaches it rather than erasing it. Neither fact is buried: the first upload
 * shows a notice (AttachmentNoticeComponent), every removal dialog repeats the
 * consequence, and the wording is "remove", never "delete permanently".
 *
 * Offline, uploads are refused outright with a plain message. Queuing them
 * would mean holding whole videos in localStorage, which does not fit and does
 * not survive a reload — a promise the app cannot keep.
 */
@Component({
  selector: 'app-attachment-panel',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent, AttachmentNoticeComponent],
  template: `
    <section>
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100">
          Files
          @if (attachments().length > 0) {
            <span class="ml-1 text-sm font-normal text-slate-500">({{ attachments().length }})</span>
          }
        </h3>
        <span class="text-xs text-slate-500">{{ used() }} of {{ quota() }} used</span>
      </div>

      <!-- Drop zone -->
      <div
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
        [class.border-blue-400]="dragging()"
        [class.bg-blue-50]="dragging()"
        class="rounded-xl border-2 border-dashed border-slate-300 p-4 text-center transition-colors dark:border-slate-600"
      >
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Drop files here, or
          <label class="cursor-pointer font-medium text-blue-600 hover:underline">
            choose files
            <input
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,text/plain,text/csv,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/rtf,application/zip"
              class="hidden"
              (change)="onPicked($event)"
            />
          </label>
        </p>
        <p class="mt-1 text-xs text-slate-500">
          Documents, photos and video. Photos are shrunk before upload, which also removes their
          location data.
        </p>

        <button
          type="button"
          (click)="showLinkForm.set(!showLinkForm())"
          class="mt-2 text-xs font-medium text-slate-500 hover:text-blue-600"
        >
          or attach a link
        </button>
      </div>

      @if (showLinkForm()) {
        <form (ngSubmit)="addLink()" class="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="linkUrl"
            [(ngModel)]="linkUrl"
            type="url"
            placeholder="https://…"
            class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <input
            name="linkTitle"
            [(ngModel)]="linkTitle"
            placeholder="Title (optional)"
            class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            type="submit"
            class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            Attach
          </button>
        </form>
      }

      <!-- In flight -->
      @for (upload of inFlight(); track upload.name) {
        <div class="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/40">
          <div class="flex items-center justify-between text-sm">
            <span class="truncate text-slate-700 dark:text-slate-200">{{ upload.name }}</span>
            <button
              type="button"
              (click)="upload.cancel()"
              class="ml-3 shrink-0 text-xs text-slate-500 hover:text-red-600"
            >
              Cancel
            </button>
          </div>
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
            <div class="h-full rounded-full bg-blue-500 transition-all" [style.width.%]="upload.percent"></div>
          </div>
        </div>
      }

      @for (message of rejections(); track message) {
        <p class="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {{ message }}
        </p>
      }

      <!-- What is attached -->
      @if (attachments().length > 0) {
        <ul class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (file of attachments(); track file.id) {
            <li class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              @if (file.kind === 'image') {
                <button type="button" (click)="preview.set(file)" class="block w-full">
                  <img
                    [src]="file.thumbnailUrl || file.url"
                    [alt]="file.caption || file.filename"
                    loading="lazy"
                    class="h-40 w-full bg-slate-100 object-cover"
                  />
                </button>
              } @else if (file.kind === 'video') {
                <!-- preload=metadata: enough for a poster frame and duration,
                     without pulling the whole clip on page load. -->
                <video [src]="file.url" controls preload="metadata" class="h-40 w-full bg-black object-contain"></video>
              } @else {
                <a
                  [href]="file.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex h-40 flex-col items-center justify-center gap-2 bg-slate-50 transition-colors hover:bg-slate-100 dark:bg-slate-700/40"
                >
                  <span class="text-3xl">{{ file.kind === 'link' ? '🔗' : '📄' }}</span>
                  <span class="px-3 text-center text-sm text-slate-600 dark:text-slate-300">Open</span>
                </a>
              }

              <div class="flex items-start justify-between gap-2 p-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {{ file.filename }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ file.kind }}@if (file.size) { · {{ bytes(file.size) }} }
                  </p>
                  @if (file.caption) {
                    <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ file.caption }}</p>
                  }
                </div>
                <button
                  type="button"
                  (click)="pendingRemove.set(file)"
                  [attr.aria-label]="'Remove ' + file.filename"
                  class="shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <!-- Lightbox -->
    @if (preview(); as shown) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
        (click)="preview.set(null)"
      >
        <img [src]="shown.url" [alt]="shown.caption || shown.filename" class="max-h-full max-w-full rounded-lg" />
      </div>
    }

    <app-attachment-notice
      [open]="showNotice()"
      (acknowledged)="noticeAcknowledged()"
      (cancelled)="cancelPendingUploads()"
    ></app-attachment-notice>

    <app-confirm-dialog
      [open]="!!pendingRemove()"
      title="Remove this file?"
      message="It will be taken off this item. The uploaded file itself stays on Habiti's storage and its link keeps working — Habiti cannot erase it yet."
      confirmLabel="Remove"
      (confirmed)="removeConfirmed()"
      (cancelled)="pendingRemove.set(null)"
    ></app-confirm-dialog>
  `
})
export class AttachmentPanelComponent {
  readonly parentType = input.required<'task' | 'project'>();
  readonly parentId = input.required<string>();

  private attachmentsService = inject(AttachmentsService);
  private uploader = inject(AttachmentUploadService);
  private toast = inject(ToastService);

  protected readonly dragging = signal(false);
  protected readonly inFlight = signal<InFlight[]>([]);
  protected readonly rejections = signal<string[]>([]);
  protected readonly preview = signal<Attachment | null>(null);
  protected readonly pendingRemove = signal<Attachment | null>(null);
  protected readonly showLinkForm = signal(false);
  protected readonly showNotice = signal(false);
  protected linkUrl = '';
  protected linkTitle = '';

  /** Files chosen while the notice is up, uploaded once it is acknowledged. */
  private queued: File[] = [];

  protected readonly attachments = computed(() =>
    this.attachmentsService.forParent(this.parentType(), this.parentId())
  );

  protected readonly used = computed(() => formatBytes(this.attachmentsService.usedBytes()));
  protected readonly quota = computed(() => formatBytes(this.attachmentsService.quotaBytes()));

  // --- picking -------------------------------------------------------------

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.handle(files);
  }

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Reset so picking the same file twice in a row still fires a change.
    input.value = '';
    if (files.length) this.handle(files);
  }

  /**
   * Everything that has to be true before a byte moves.
   *
   * Offline, size, type and quota are all checked HERE, before any request —
   * the alternative is telling someone their video was too big after they have
   * already uploaded it over mobile data.
   */
  private handle(files: File[]): void {
    this.rejections.set([]);

    if (!navigator.onLine) {
      this.rejections.set([
        'You are offline. Files upload when you are back online — nothing is queued, so try again then.'
      ]);
      return;
    }

    const accepted: File[] = [];
    const refused: string[] = [];
    let projected = 0;

    for (const file of files) {
      const reason = this.uploader.rejectionReason(file);
      if (reason) {
        refused.push(reason);
        continue;
      }
      if (this.attachmentsService.wouldExceedQuota(projected + file.size)) {
        refused.push(`${file.name} would take you over your storage limit.`);
        continue;
      }
      projected += file.size;
      accepted.push(file);
    }

    this.rejections.set(refused);
    if (accepted.length === 0) return;

    if (!this.attachmentsService.hasSeenNotice()) {
      this.queued = accepted;
      this.showNotice.set(true);
      return;
    }

    for (const file of accepted) this.startUpload(file);
  }

  protected noticeAcknowledged(): void {
    this.attachmentsService.markNoticeSeen();
    this.showNotice.set(false);
    const files = this.queued;
    this.queued = [];
    for (const file of files) this.startUpload(file);
  }

  protected cancelPendingUploads(): void {
    this.queued = [];
    this.showNotice.set(false);
  }

  private startUpload(file: File): void {
    const kind = this.uploader.kindOf(file);

    const subscription = this.uploader.upload(file).subscribe({
      next: progress => {
        if (progress.state === 'done' && progress.file) {
          this.record(progress.file, kind);
          this.clearInFlight(file.name);
        } else {
          this.setPercent(file.name, progress.percent ?? 0);
        }
      },
      error: (error: Error) => {
        this.clearInFlight(file.name);
        this.rejections.update(list => [...list, error.message || `${file.name} could not be uploaded.`]);
      }
    });

    this.inFlight.update(list => [
      ...list,
      { name: file.name, percent: 0, cancel: () => {
        subscription.unsubscribe();
        this.clearInFlight(file.name);
      } }
    ]);
  }

  private record(uploaded: UploadedFile, kind: Attachment['kind']): void {
    this.attachmentsService.add(this.parentType(), this.parentId(), uploaded, kind);
    this.toast.success('File attached', uploaded.originalName);
  }

  private setPercent(name: string, percent: number): void {
    this.inFlight.update(list =>
      list.map(item => (item.name === name ? { ...item, percent } : item))
    );
  }

  private clearInFlight(name: string): void {
    this.inFlight.update(list => list.filter(item => item.name !== name));
  }

  // --- links and removal ---------------------------------------------------

  protected addLink(): void {
    const url = this.linkUrl.trim();
    if (!url) return;

    this.attachmentsService.addLink(this.parentType(), this.parentId(), url, this.linkTitle);
    this.linkUrl = '';
    this.linkTitle = '';
    this.showLinkForm.set(false);
  }

  protected removeConfirmed(): void {
    const file = this.pendingRemove();
    this.pendingRemove.set(null);
    if (!file) return;
    this.attachmentsService.remove(file.id);
    this.toast.success('File removed', 'It is no longer attached to this item.');
  }

  protected bytes(size: number): string {
    return formatBytes(size);
  }
}
