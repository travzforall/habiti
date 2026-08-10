import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FriendsService } from '../../services/friends.service';

/**
 * Desktop navigation.
 *
 * This is the ONLY place route links live on large screens — the top bar
 * carries identity and status, and the bottom bar covers everything below
 * `lg`. Duplicating links in the top bar is what overflowed it and pushed the
 * profile menu (and Sign out with it) off-screen.
 *
 * The markup used to sit inline in a shell component that was never
 * bootstrapped, so none of it rendered. It is a component now so there is one
 * copy and it is obvious where it is mounted.
 */
@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterModule],
  template: `
    <aside class="hidden lg:block w-48 shrink-0 px-2">
      <!-- data-tour: app guide step 9a, the >=1024px variant. Its mobile twin
           is the bottom nav. See src/app/config/app-tour.steps.ts. -->
      <div
        data-tour="side-nav"
        class="sticky top-24 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-2"
      >
        <nav class="space-y-1">
          @for (item of items; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
              class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-all duration-200 group"
            >
              <span class="text-xl group-hover:scale-110 transition-transform">{{ item.icon }}</span>
              <span class="font-medium">{{ item.label }}</span>
              @if (item.route === '/friends' && incomingFriendRequests() > 0) {
                <span
                  class="ml-auto px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold"
                >
                  {{ incomingFriendRequests() }}
                </span>
              }
            </a>
          }

          <div class="border-t border-slate-200 my-3"></div>

          <a
            routerLink="/settings"
            routerLinkActive="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-all duration-200 group"
          >
            <span class="text-xl group-hover:scale-110 transition-transform">⚙️</span>
            <span class="font-medium">Settings</span>
          </a>
        </nav>
      </div>
    </aside>
  `
})
export class SideNavComponent {
  private friends = inject(FriendsService);

  /** Signal-backed, so an invite arriving in the background updates the badge. */
  protected readonly incomingFriendRequests = this.friends.incomingCount;

  protected readonly items = [
    { route: '/dashboard', icon: '📊', label: 'Dashboard' },
    { route: '/habits', icon: '✅', label: 'Habits' },
    { route: '/challenges', icon: '🏆', label: 'Challenges' },
    { route: '/skills', icon: '🧭', label: 'Skills' },
    { route: '/friends', icon: '👥', label: 'Friends' },
    { route: '/tasks', icon: '📝', label: 'Tasks' },
    { route: '/projects', icon: '📋', label: 'Projects' },
    { route: '/calendar', icon: '📅', label: 'Calendar' },
    { route: '/analytics', icon: '📈', label: 'Analytics' },
    { route: '/game', icon: '🎮', label: 'Gamification' },
    { route: '/templates', icon: '📋', label: 'Templates' }
  ];
}
