import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../services/sync.service';

/**
 * Whether the app is up to date, and how.
 *
 * Lives in the top nav, which is on every route — so the answer is available
 * from any screen. Deliberately never says "disconnected": with no relay the
 * app is still perfectly current, just on a slower cadence, and alarming the
 * user about a healthy state would be a lie in the other direction.
 */
@Component({
  selector: 'app-live-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      [title]="tooltip()"
      [attr.aria-label]="tooltip()"
    >
      <span
        class="w-2 h-2 rounded-full flex-shrink-0"
        [class]="dotClass()"
        [class.animate-pulse]="label() === 'live' || label() === 'syncing'"
      ></span>
      <span class="hidden sm:inline text-xs font-medium" [class]="textClass()">
        {{ text() }}
      </span>
    </div>
  `
})
export class LiveIndicatorComponent {
  private sync = inject(SyncService);

  protected readonly label = this.sync.connectionLabel;

  protected readonly text = computed(() => {
    switch (this.label()) {
      case 'live':
        return 'Live';
      case 'syncing':
        return 'Syncing…';
      case 'offline':
        return 'Offline';
      default:
        return 'Synced';
    }
  });

  protected readonly dotClass = computed(() => {
    switch (this.label()) {
      case 'live':
        return 'bg-emerald-500';
      case 'syncing':
        return 'bg-blue-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  });

  protected readonly textClass = computed(() => {
    switch (this.label()) {
      case 'live':
        return 'text-emerald-600';
      case 'syncing':
        return 'text-blue-600';
      case 'offline':
        return 'text-red-600';
      default:
        return 'text-slate-500';
    }
  });

  protected readonly tooltip = computed(() => {
    switch (this.label()) {
      case 'live':
        return 'Updates arrive instantly';
      case 'syncing':
        return 'Checking for updates…';
      case 'offline':
        return "Changes are saved locally and sync when you're back";
      default: {
        const at = this.sync.lastSyncAt();
        return at ? `Up to date — last checked ${at.toLocaleTimeString()}` : 'Up to date';
      }
    }
  });
}
