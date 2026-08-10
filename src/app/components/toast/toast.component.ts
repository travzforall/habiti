import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!--
      Sits BELOW the fixed top bar and ABOVE it in stacking order.

      top-4/z-50 put it behind the nav: same z-index as the bar, and the bar
      comes later in the DOM, so it won. The offset clears the taller mobile bar
      (h-16 plus the stats row) and tightens up at lg.
    -->
    <div class="fixed top-28 lg:top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none"
         role="region"
         aria-label="Notifications">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item pointer-events-auto animate-slide-in"
             [class]="getToastClasses(toast)"
             role="alert"
             [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'">
          <div class="flex items-start gap-3">
            <!-- Icon -->
            <div class="flex-shrink-0 mt-0.5">
              @switch (toast.type) {
                @case ('success') {
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                }
                @case ('error') {
                  <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                }
                @case ('warning') {
                  <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                }
                @case ('info') {
                  <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                }
              }
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100">
                {{ toast.title }}
              </p>
              @if (toast.message) {
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ toast.message }}
                </p>
              }
            </div>

            <!-- Dismiss button -->
            @if (toast.dismissible) {
              <button
                type="button"
                class="flex-shrink-0 inline-flex text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                (click)="dismiss(toast.id)"
                aria-label="Dismiss notification">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            }
          </div>

          <!-- Progress bar -->
          @if (toast.duration > 0) {
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 rounded-b-lg overflow-hidden">
              <div class="h-full transition-all ease-linear"
                   [class]="getProgressBarClasses(toast)"
                   [style.animation-duration.ms]="toast.duration">
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes progress {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }

    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }

    .animate-progress {
      animation: progress linear forwards;
    }

    .toast-item {
      position: relative;
      overflow: hidden;
    }
  `]
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);

  getToastClasses(toast: Toast): string {
    const baseClasses = 'p-4 rounded-lg shadow-lg backdrop-blur-sm border';

    const typeClasses: Record<string, string> = {
      success: 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-800',
      error: 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-800',
      warning: 'bg-yellow-50/95 dark:bg-yellow-900/90 border-yellow-200 dark:border-yellow-800',
      info: 'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-800'
    };

    return `${baseClasses} ${typeClasses[toast.type]}`;
  }

  getProgressBarClasses(toast: Toast): string {
    const colorClasses: Record<string, string> = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };

    return `animate-progress ${colorClasses[toast.type]}`;
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
