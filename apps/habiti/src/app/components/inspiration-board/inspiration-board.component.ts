import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InspirationService } from '../../services/inspiration.service';
import { InspirationItem } from '../../models/inspiration.models';
import { recogniseMedia, titleFrom } from '../../config/media-links';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

/**
 * A board of things that make you want to do the work: YouTube videos,
 * pictures, links, notes.
 *
 * Used twice — on /inspiration for the personal board, and in a project's
 * sidebar for that project's own — so `board` is the only input that matters.
 *
 * ── WHY VIDEOS DO NOT PLAY IN THE PAGE ────────────────────────────────────
 *
 * An inline YouTube player means an <iframe> whose src has to be marked safe,
 * which means DomSanitizer. This app deliberately has no HTML-injection
 * surface at all — no innerHTML, no sanitiser, no markdown renderer — and that
 * property is worth more than saving a click. An embed is also a third-party
 * frame with its own cookies and its own view of the user, on a page in an app
 * that sets no cookies and runs no analytics.
 *
 * So a video is a thumbnail with a play badge, and clicking it opens YouTube in
 * a new tab. The thumbnail itself is still fetched from Google, which is the
 * one privacy cost here and is stated on the board rather than buried.
 */
@Component({
  selector: 'app-inspiration-board',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent],
  template: `
    <section>
      <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100">
          {{ heading() }}
          @if (items().length > 0) {
            <span class="ml-1 text-sm font-normal text-slate-500">({{ items().length }})</span>
          }
        </h2>
      </div>

      <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Paste a YouTube link, a picture address, or anything worth keeping. Nothing is copied to
        Habiti — a card points at the original, so video thumbnails are loaded from YouTube, which
        means Google sees your IP address when a board is on screen.
      </p>

      <!-- Add -->
      <form (ngSubmit)="add()" class="mb-4 space-y-2">
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            name="url"
            [(ngModel)]="draftUrl"
            [placeholder]="mode() === 'note' ? 'What do you want to remember?' : 'https://youtube.com/watch?v=…'"
            class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <button
            type="submit"
            class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Add
          </button>
        </div>

        <div class="flex items-center gap-3 text-xs">
          <button
            type="button"
            (click)="mode.set(mode() === 'link' ? 'note' : 'link')"
            class="font-medium text-slate-500 hover:text-blue-600"
          >
            {{ mode() === 'link' ? 'or write a note' : 'or paste a link' }}
          </button>
          @if (error(); as message) {
            <span class="text-red-600">{{ message }}</span>
          }
        </div>
      </form>

      <!-- The board -->
      @if (items().length === 0) {
        <p class="py-8 text-center text-sm text-slate-500">
          Nothing here yet. The first video you save shows up as a card.
        </p>
      } @else {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          @for (item of items(); track item.id) {
            <li class="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              @if (item.kind === 'note') {
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-blue-50 to-slate-50 p-4 dark:from-slate-700 dark:to-slate-800">
                  <p class="line-clamp-5 text-center text-sm text-slate-700 dark:text-slate-200">
                    {{ item.note }}
                  </p>
                </div>
              } @else if (item.thumbnailUrl && !broken().has(item.id)) {
                <a
                  [href]="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="relative block"
                  [attr.aria-label]="'Open ' + item.title"
                >
                  <!--
                    referrerpolicy: the thumbnail request should not tell Google
                    which page it came from. loading=lazy keeps a long board
                    from firing thirty requests at once.
                  -->
                  <img
                    [src]="item.thumbnailUrl"
                    [alt]="item.title"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    (error)="markBroken(item.id)"
                    class="h-40 w-full bg-slate-100 object-cover dark:bg-slate-700"
                  />
                  @if (item.kind === 'video') {
                    <span
                      class="absolute inset-0 flex items-center justify-center bg-black/25 text-4xl text-white transition-colors group-hover:bg-black/40"
                      aria-hidden="true"
                      >▶</span
                    >
                  }
                </a>
              } @else {
                <a
                  [href]="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex h-40 flex-col items-center justify-center gap-2 bg-slate-50 transition-colors hover:bg-slate-100 dark:bg-slate-700/40"
                >
                  <span class="text-3xl" aria-hidden="true">{{ icon(item) }}</span>
                  <span class="px-3 text-center text-xs text-slate-500">
                    {{ broken().has(item.id) ? 'Preview unavailable' : 'Open' }}
                  </span>
                </a>
              }

              <div class="flex items-start justify-between gap-2 p-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {{ item.title }}
                  </p>
                  @if (item.note && item.kind !== 'note') {
                    <p class="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                      {{ item.note }}
                    </p>
                  }
                </div>

                <div class="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    (click)="inspiration.move(item.id, -1)"
                    [attr.aria-label]="'Move ' + item.title + ' earlier'"
                    class="rounded p-1 text-slate-400 hover:text-blue-600"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    (click)="inspiration.move(item.id, 1)"
                    [attr.aria-label]="'Move ' + item.title + ' later'"
                    class="rounded p-1 text-slate-400 hover:text-blue-600"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    (click)="pendingRemove.set(item)"
                    [attr.aria-label]="'Remove ' + item.title"
                    class="rounded p-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <app-confirm-dialog
      [open]="!!pendingRemove()"
      title="Remove this?"
      [message]="
        '“' + (pendingRemove()?.title ?? '') + '” comes off the board. Whatever it points at is untouched.'
      "
      confirmLabel="Remove"
      (confirmed)="removeConfirmed()"
      (cancelled)="pendingRemove.set(null)"
    ></app-confirm-dialog>
  `
})
export class InspirationBoardComponent {
  readonly board = input.required<string>();
  readonly heading = input('Inspiration');

  protected readonly inspiration = inject(InspirationService);

  protected draftUrl = '';
  protected readonly mode = signal<'link' | 'note'>('link');
  protected readonly error = signal<string | null>(null);
  protected readonly pendingRemove = signal<InspirationItem | null>(null);
  /** Thumbnails that 404'd — a deleted video, a moved picture. */
  protected readonly broken = signal<Set<string>>(new Set());

  protected readonly items = computed(() => this.inspiration.forBoard(this.board()));

  protected add(): void {
    const input = this.draftUrl.trim();
    if (!input) return;

    if (this.mode() === 'note') {
      if (!this.inspiration.addNote(this.board(), input)) {
        this.error.set('Write something first.');
        return;
      }
    } else {
      const media = recogniseMedia(input);
      if (!media) {
        this.error.set(
          'That does not look like a web address. Paste a link starting with https://'
        );
        return;
      }
      this.inspiration.addLink(this.board(), media, titleFrom(media, input));
    }

    this.draftUrl = '';
    this.error.set(null);
  }

  protected removeConfirmed(): void {
    const item = this.pendingRemove();
    this.pendingRemove.set(null);
    if (item) this.inspiration.remove(item.id);
  }

  protected markBroken(id: string): void {
    this.broken.update(set => new Set(set).add(id));
  }

  protected icon(item: InspirationItem): string {
    switch (item.kind) {
      case 'video':
        return '🎬';
      case 'image':
        return '🖼️';
      case 'note':
        return '📝';
      default:
        return '🔗';
    }
  }
}
