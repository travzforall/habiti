import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  dismissible: boolean;
  timestamp: Date;
}

export interface ToastOptions {
  duration?: number;
  dismissible?: boolean;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private timeoutMap = new Map<string, ReturnType<typeof setTimeout>>();

  // Public computed signals
  readonly toasts = this._toasts.asReadonly();
  readonly hasToasts = computed(() => this._toasts().length > 0);

  /**
   * Show a success toast
   */
  success(title: string, message?: string, options?: ToastOptions): string {
    return this.show('success', title, message, options);
  }

  /**
   * Show an error toast
   */
  error(title: string, message?: string, options?: ToastOptions): string {
    return this.show('error', title, message, { duration: 8000, ...options });
  }

  /**
   * Show a warning toast
   */
  warning(title: string, message?: string, options?: ToastOptions): string {
    return this.show('warning', title, message, options);
  }

  /**
   * Show an info toast
   */
  info(title: string, message?: string, options?: ToastOptions): string {
    return this.show('info', title, message, options);
  }

  /**
   * Show a toast notification
   */
  show(type: ToastType, title: string, message?: string, options?: ToastOptions): string {
    const id = this.generateId();
    const duration = options?.duration ?? DEFAULT_DURATION;
    const dismissible = options?.dismissible ?? true;

    const toast: Toast = {
      id,
      type,
      title,
      message,
      duration,
      dismissible,
      timestamp: new Date()
    };

    // Add toast and limit to MAX_TOASTS
    this._toasts.update(toasts => {
      const newToasts = [toast, ...toasts];
      if (newToasts.length > MAX_TOASTS) {
        // Remove oldest toasts and clear their timeouts
        const removed = newToasts.slice(MAX_TOASTS);
        removed.forEach(t => this.clearTimeout(t.id));
        return newToasts.slice(0, MAX_TOASTS);
      }
      return newToasts;
    });

    // Auto-dismiss after duration
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timeoutMap.set(id, timeout);
    }

    return id;
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(id: string): void {
    this.clearTimeout(id);
    this._toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.timeoutMap.forEach((_, id) => this.clearTimeout(id));
    this._toasts.set([]);
  }

  private clearTimeout(id: string): void {
    const timeout = this.timeoutMap.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutMap.delete(id);
    }
  }

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
