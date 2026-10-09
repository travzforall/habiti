import { Component, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * What happens to a file before the first one is uploaded.
 *
 * ── WHY THIS IS NOT OPTIONAL ──────────────────────────────────────────────
 *
 * Three things are true of an attachment today, and none of them is what a
 * reasonable person would assume:
 *
 *   1. The file is stored at a PUBLIC URL. It is long and random, so it will
 *      not be found by guessing or by a search engine — but it is served with
 *      no authentication, so anyone who has the link can open it. Verified
 *      against the instance, not assumed.
 *   2. Removing an attachment detaches it. Habiti cannot yet erase the stored
 *      file, so the link keeps working.
 *   3. Photos are re-encoded on the way up, which strips their location data.
 *      Video is not, and keeps whatever metadata the camera wrote.
 *
 * Someone photographing a prescription, a payslip or a letter to attach to a
 * task deserves to know all three BEFORE they do it, once, in plain words. This
 * is that notice. It is shown once per account and is deliberately not styled
 * as a consent gate — it is information, and the button says so.
 *
 * See also: the privacy policy's "Files you attach" section, which says the
 * same in the document that has to be durable.
 */
@Component({
  selector: 'app-attachment-notice',
  standalone: true,
  imports: [RouterModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="attachment-notice-title"
          class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
        >
          <h2
            id="attachment-notice-title"
            class="text-xl font-bold text-slate-900 dark:text-slate-100"
          >
            Before you attach a file
          </h2>

          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Worth knowing once, in plain terms:
          </p>

          <ul class="mt-3 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <li class="flex gap-3">
              <span aria-hidden="true">🔗</span>
              <span>
                Your file is stored with a long, random web address. It is not listed anywhere and
                will not turn up in a search — but
                <strong>anyone who has that address can open it</strong>, without signing in. Please
                do not attach anything you would not want a stranger to read if the link got out.
              </span>
            </li>
            <li class="flex gap-3">
              <span aria-hidden="true">🗑️</span>
              <span>
                Removing a file takes it off the task, but Habiti
                <strong>cannot delete the stored copy yet</strong>, so its link keeps working.
              </span>
            </li>
            <li class="flex gap-3">
              <span aria-hidden="true">📍</span>
              <span>
                Photos are shrunk before they are sent, which also removes the location stored in
                them. Video is sent as-is and keeps whatever your camera recorded.
              </span>
            </li>
          </ul>

          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            The same is written in the
            <a routerLink="/legal/privacy" class="font-medium text-blue-600 hover:underline">
              privacy policy </a
            >, and what Habiti can and cannot promise about security is on the
            <a routerLink="/trust" class="font-medium text-blue-600 hover:underline">Trust page</a>.
          </p>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="cancelled.emit()"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Not now
            </button>
            <button
              type="button"
              (click)="acknowledged.emit()"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Got it — upload
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AttachmentNoticeComponent {
  readonly open = input(false);
  readonly acknowledged = output<void>();
  readonly cancelled = output<void>();
}
