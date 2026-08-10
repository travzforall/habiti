import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { CURRENT_USER_ID } from '@habiti/storage';
import { REALTIME_URL, SYNC_SESSION } from '@habiti/sync';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { provideSyncRefreshers } from './services/sync-refreshers.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // The interceptor attaches the Xano JWT and signs the user out on a 401.
    // Baserow requests pass through untouched — BaserowService owns that header
    // and is the seam that moves behind a server proxy later.
    provideHttpClient(withInterceptors([authInterceptor])),

    /**
     * Tells @habiti/storage which account to namespace local data under.
     *
     * The library takes a function rather than injecting AuthService, so it
     * stays free of any particular auth implementation. This is where THIS app
     * says "we authenticate with Xano, and the id is on currentUserValue".
     */
    {
      provide: CURRENT_USER_ID,
      useFactory: () => {
        const auth = inject(AuthService);
        return () => {
          const id = auth.currentUserValue?.id;
          return id === undefined || id === null ? null : String(id);
        };
      }
    },

    /**
     * The session @habiti/sync schedules around.
     *
     * The library asks three questions and this is where THIS app answers them
     * from Xano. A kiosk holding a device credential answers the same three
     * without ever having a `currentUser`.
     */
    {
      provide: SYNC_SESSION,
      useFactory: () => {
        const auth = inject(AuthService);
        const idOf = (user: { id?: number | string } | null) =>
          user?.id === undefined || user?.id === null ? null : String(user.id);
        return {
          userId$: auth.currentUser.pipe(map(idOf)),
          currentUserId: () => idOf(auth.currentUserValue),
          token: () => auth.getToken?.() ?? null
        };
      }
    },

    // Where the relay is. '' means never open a socket, which is the correct
    // default — see the token's own comment for why that matters.
    { provide: REALTIME_URL, useValue: environment.realtime?.url ?? '' },

    // Tells SyncService which domains exist. Without this the app still runs,
    // and silently never reloads anything — so it belongs at the root config
    // where its absence is visible, not buried in a feature.
    provideSyncRefreshers()
  ]
};
