import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminGuard, isAdminRole } from './admin.guard';

/**
 * The page this gates writes content every user reads, so the interesting
 * cases are the negative ones: a normal signed-in user, a missing role, and
 * anything that merely looks like a role.
 */
describe('adminGuard', () => {
  let router: { navigate: jasmine.Spy };
  let auth: { isAuthenticated: jasmine.Spy; currentUserValue: unknown };

  function run(): boolean | unknown {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as never, { url: '/admin' } as never)
    );
  }

  function setup(user: unknown, authenticated = true): void {
    // Several tests loop over roles, and configureTestingModule throws once the
    // injector has been used — so each case starts from a clean TestBed.
    TestBed.resetTestingModule();

    router = { navigate: jasmine.createSpy('navigate') };
    auth = {
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(authenticated),
      currentUserValue: user
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth }
      ]
    });
  }

  it('lets an admin through', () => {
    setup({ id: 1, role: 'admin' });
    expect(run()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('accepts the other privileged roles', () => {
    for (const role of ['owner', 'superadmin']) {
      setup({ id: 1, role });
      expect(run()).withContext(role).toBe(true);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    setup({ id: 1, role: '  Admin ' });
    expect(run()).toBe(true);
  });

  it('turns away an ordinary signed-in user', () => {
    setup({ id: 2, role: 'user' });

    expect(run()).toBe(false);
    // A redirect, not a 403: an unlisted area should not confirm it exists.
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('turns away a user with no role at all', () => {
    setup({ id: 3 });
    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('turns away a user whose role merely contains "admin"', () => {
    // Guards against a substring check creeping in later.
    for (const role of ['administrator-readonly', 'not-admin', 'adminish']) {
      setup({ id: 4, role });
      expect(run()).withContext(role).toBe(false);
    }
  });

  it('sends an unauthenticated visitor to login, not the dashboard', () => {
    setup(null, false);

    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not treat a missing user object as an admin', () => {
    setup(null);
    expect(run()).toBe(false);
  });

  describe('isAdminRole', () => {
    it('matches the guard', () => {
      expect(isAdminRole('admin')).toBe(true);
      expect(isAdminRole('OWNER')).toBe(true);
      expect(isAdminRole('user')).toBe(false);
      expect(isAdminRole(undefined)).toBe(false);
      expect(isAdminRole(null)).toBe(false);
      expect(isAdminRole('')).toBe(false);
    });
  });
});
