import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
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
    // Tells SyncService which domains exist. Without this the app still runs,
    // and silently never reloads anything — so it belongs at the root config
    // where its absence is visible, not buried in a feature.
    provideSyncRefreshers()
  ]
};
