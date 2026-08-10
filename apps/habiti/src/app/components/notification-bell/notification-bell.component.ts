import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppNotification, NotificationsService } from '../../services/notifications.service';

/**
 * The notification bell.
 *
 * Nothing here is real-time — the list is derived from data already loaded, so
 * it fills in when the app next fetches. Unread state persists in localStorage
 * so it survives a reload.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <button
        type="button"
        class="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        [attr.aria-label]="ariaLabel()"
        (click)="toggle($event)"
      >
        <span class="text-lg" [class.bell-ring]="hasUnread()">🔔</span>
        @if (unreadCount() > 0) {
          <span
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow"
          >
            {{ unreadCount() > 9 ? '9+' : unreadCount() }}
          </span>
        }
      </button>

      @if (open()) {
        <div
          class="absolute right-0 top-11 w-80 max-w-[90vw] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700"
          >
            <span class="font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
            @if (unreadCount() > 0) {
              <button
                type="button"
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                (click)="markAllRead()"
              >
                Mark all read
              </button>
            }
          </div>

          <div class="max-h-96 overflow-y-auto">
            @if (items().length === 0) {
              <div class="px-4 py-8 text-center">
                <div class="text-2xl mb-1">🌙</div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Nothing new.</p>
              </div>
            } @else {
              @for (item of items(); track item.id) {
                <button
                  type="button"
                  class="w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                  [class.bg-blue-50]="isUnread(item)"
                  [class.dark:bg-blue-900/20]="isUnread(item)"
                  (click)="go(item)"
                >
                  <span class="text-lg leading-none mt-0.5">{{ item.icon }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm text-slate-800 dark:text-slate-100">
                      {{ item.title }}
                    </span>
                    @if (item.body) {
                      <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {{ item.body }}
                      </span>
                    }
                  </span>
                  @if (isUnread(item)) {
                    <span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"></span>
                  }
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bell-ring {
        display: inline-block;
        animation: bell-shake 2.5s ease-in-out infinite;
        transform-origin: top center;
      }
      @keyframes bell-shake {
        0%,
        88%,
        100% {
          transform: rotate(0);
        }
        90% {
          transform: rotate(12deg);
        }
        93% {
          transform: rotate(-10deg);
        }
        96% {
          transform: rotate(6deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .bell-ring {
          animation: none;
        }
      }
    `
  ]
})
export class NotificationBellComponent {
  private notifications = inject(NotificationsService);
  private router = inject(Router);

  protected readonly open = signal(false);
  protected readonly items = this.notifications.all;
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly hasUnread = this.notifications.hasUnread;

  protected readonly ariaLabel = computed(() =>
    this.unreadCount() > 0
      ? `Notifications, ${this.unreadCount()} unread`
      : 'Notifications'
  );

  protected isUnread(item: AppNotification): boolean {
    return this.notifications.unread().some(n => n.id === item.id);
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update(o => !o);
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  /** Reading one dismisses it and takes you where it happened. */
  protected go(item: AppNotification): void {
    this.notifications.markRead(item.id);
    this.open.set(false);
    this.router.navigate([item.route]);
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.open()) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.open.set(false);
  }
}
