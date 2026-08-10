import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

const XANO = environment.xano.apiUrl;
const BASEROW = environment.baserow.apiUrl;

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: { navigate: jasmine.Spy };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    router = { navigate: jasmine.createSpy('navigate') };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('attaching credentials', () => {
    it('adds the Bearer token to a Xano request', () => {
      localStorage.setItem('auth_token', 'jwt-123');

      http.get(`${XANO}/auth/me`).subscribe();
      const req = controller.expectOne(`${XANO}/auth/me`);

      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
      req.flush({});
    });

    it('reads the token from sessionStorage when "remember me" was off', () => {
      sessionStorage.setItem('auth_token', 'session-jwt');

      http.get(`${XANO}/auth/me`).subscribe();
      const req = controller.expectOne(`${XANO}/auth/me`);

      expect(req.request.headers.get('Authorization')).toBe('Bearer session-jwt');
      req.flush({});
    });

    it('NEVER sends the Xano token to Baserow — that would leak a user credential', () => {
      localStorage.setItem('auth_token', 'jwt-123');

      http.get(`${BASEROW}/521/`).subscribe();
      const req = controller.expectOne(`${BASEROW}/521/`);

      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('leaves unrelated hosts alone', () => {
      localStorage.setItem('auth_token', 'jwt-123');

      http.get('https://example.com/thing').subscribe();
      const req = controller.expectOne('https://example.com/thing');

      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('sends no header on login — there is no token yet', () => {
      http.post(`${XANO}/auth/login`, {}).subscribe();
      const req = controller.expectOne(`${XANO}/auth/login`);

      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('sends no header on signup even if a stale token is lying around', () => {
      localStorage.setItem('auth_token', 'stale');

      http.post(`${XANO}/auth/signup`, {}).subscribe();
      const req = controller.expectOne(`${XANO}/auth/signup`);

      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });

    it('sends nothing when there is no token', () => {
      http.get(`${XANO}/auth/me`).subscribe();
      const req = controller.expectOne(`${XANO}/auth/me`);

      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
    });
  });

  describe('on 401', () => {
    it('clears the session and redirects to login', () => {
      localStorage.setItem('auth_token', 'expired');
      localStorage.setItem('current_user', '{}');

      http.get(`${XANO}/auth/me`).subscribe({ error: () => {} });
      controller
        .expectOne(`${XANO}/auth/me`)
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('current_user')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { expired: 'true' }
      });
    });

    it('does NOT sign the user out over a Baserow 401 — that is a config problem', () => {
      localStorage.setItem('auth_token', 'still-valid');

      http.get(`${BASEROW}/521/`).subscribe({ error: () => {} });
      controller.expectOne(`${BASEROW}/521/`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('auth_token')).toBe('still-valid');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('does not redirect when login itself is rejected — that is a wrong password', () => {
      http.post(`${XANO}/auth/login`, {}).subscribe({ error: () => {} });
      controller.expectOne(`${XANO}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('passes other errors through untouched', () => {
      let status = 0;
      http.get(`${XANO}/auth/me`).subscribe({ error: err => (status = err.status) });
      controller.expectOne(`${XANO}/auth/me`).flush({}, { status: 500, statusText: 'Server Error' });

      expect(status).toBe(500);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
