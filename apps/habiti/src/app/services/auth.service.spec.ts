import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

/**
 * Sign-out must not depend on the network.
 *
 * The original implementation did its cleanup in the `complete` callback, and
 * RxJS does not call `complete` after an error. So an expired token made
 * POST /auth/logout return 401, cleanup never ran, and the user was trapped in
 * a dead session with no way out of the app — the one moment they most need
 * logout to work is the one moment it did not.
 */
describe('AuthService.logout', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
      provideTestUserId(),
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    localStorage.clear();
    sessionStorage.clear();
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function signedIn(storage: Storage): void {
    storage.setItem('auth_token', 'a-token');
    storage.setItem('current_user', JSON.stringify({ id: 1, email: 'a@b.com' }));
  }

  function expectSignedOut(): void {
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('current_user')).toBeNull();
    expect(sessionStorage.getItem('current_user')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }

  it('signs out even when the server rejects the token', () => {
    signedIn(localStorage);

    service.logout();
    // The exact case that used to trap the user.
    http.expectOne(r => r.url.includes('/auth/logout')).flush(
      { message: 'Unauthenticated' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expectSignedOut();
  });

  it('signs out even when the network is down', () => {
    signedIn(localStorage);

    service.logout();
    http.expectOne(r => r.url.includes('/auth/logout')).error(new ProgressEvent('network error'));

    expectSignedOut();
  });

  it('signs out on a successful call', () => {
    signedIn(localStorage);

    service.logout();
    http.expectOne(r => r.url.includes('/auth/logout')).flush({});

    expectSignedOut();
  });

  it('clears a session-storage login too', () => {
    // "Remember me" off stores in sessionStorage; logout must clear both.
    signedIn(sessionStorage);

    service.logout();
    http.expectOne(r => r.url.includes('/auth/logout')).flush({});

    expectSignedOut();
  });

  it('signs out with no token at all, without calling the API', () => {
    localStorage.setItem('current_user', JSON.stringify({ id: 1 }));

    service.logout();

    http.expectNone(r => r.url.includes('/auth/logout'));
    expectSignedOut();
  });

  it('clears local state before the request resolves', () => {
    signedIn(localStorage);

    service.logout();
    // Not yet flushed: the user is already out, which is what makes logout
    // feel instant and keeps it independent of a slow or hanging server.
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);

    http.expectOne(r => r.url.includes('/auth/logout')).flush({});
  });

  it('emits null so the sync layer tears down', () => {
    signedIn(localStorage);

    const seen: unknown[] = [];
    const sub = service.currentUser.subscribe(user => seen.push(user));
    // currentUser is a BehaviorSubject, so subscribing replays the current
    // value. Drop it — the emission under test is the one logout causes.
    seen.length = 0;

    service.logout();
    http.expectOne(r => r.url.includes('/auth/logout')).flush({});

    // SyncService watches this to reset the data services and drop the socket.
    expect(seen).toEqual([null]);
    sub.unsubscribe();
  });
});
