import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  viewChild
} from '@angular/core';

/**
 * "Are you sure?", done properly, once.
 *
 * Deletion across tasks, projects and the dashboard went through
 * `window.confirm`, which is synchronous, unstyleable, unreadable on a phone,
 * and blocked on some in-app browsers — where it returns false and the delete
 * silently never happens.
 *
 * Three things this has to get right, none of which the browser's own dialog
 * gave us and all of which are easy to leave out:
 *
 *   - FOCUS goes into the dialog when it opens and returns to whatever opened
 *     it when it closes. Otherwise a keyboard user is dropped back at the top
 *     of the document, and a screen reader announces nothing at all.
 *   - TAB is trapped inside it. A dialog you can tab out of, into the page it
 *     is covering, is a dialog in name only.
 *   - ESCAPE cancels, and the destructive action is never the default focus —
 *     the cancel button holds it, so a stray Enter is harmless.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        (click)="onBackdrop($event)"
      >
        <div
          #panel
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="messageId"
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
        >
          <h2 [id]="titleId" class="text-lg font-bold text-slate-900 dark:text-slate-100">
            {{ title() }}
          </h2>

          <p [id]="messageId" class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {{ message() }}
          </p>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              #cancelButton
              type="button"
              (click)="cancelled.emit()"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              (click)="confirmed.emit()"
              [class]="confirmClasses()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('Are you sure?');
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly tone = input<'danger' | 'primary'>('danger');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  /** Unique per instance, so two dialogs on one page cannot share an id. */
  private readonly uid = Math.random().toString(36).slice(2, 8);
  protected readonly titleId = `confirm-title-${this.uid}`;
  protected readonly messageId = `confirm-message-${this.uid}`;

  private previouslyFocused: HTMLElement | null = null;

  protected readonly confirmClasses = computed(() =>
    this.tone() === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        // Focus the SAFE button. A destructive default is how a stray Enter
        // deletes something nobody meant to delete.
        queueMicrotask(() => this.cancelButton()?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
      return;
    }

    if (event.key === 'Tab') this.trapTab(event);
  }

  protected onBackdrop(event: MouseEvent): void {
    // Only a click on the backdrop itself, never one that bubbled from inside.
    if (event.target === event.currentTarget) this.cancelled.emit();
  }

  private trapTab(event: KeyboardEvent): void {
    const root = this.panel()?.nativeElement;
    if (!root) return;

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
