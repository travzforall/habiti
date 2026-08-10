import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { UserStorage } from './user-storage';

/**
 * Account isolation for locally-stored data.
 *
 * Tasks, projects and habits all lived under global keys, so signing in as a
 * second person on the same browser showed the first person's data with nothing
 * to indicate it. On a shared machine that is a privacy failure, and it is
 * completely invisible from the UI — which is why it is asserted here.
 */
class MockAuth {
  currentUserValue: { id: number | string } | null = { id: 6 };
}

describe('UserStorage', () => {
  let storage: UserStorage;
  let auth: MockAuth;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [UserStorage, { provide: AuthService, useClass: MockAuth }]
    });
    storage = TestBed.inject(UserStorage);
    auth = TestBed.inject(AuthService) as unknown as MockAuth;
  });

  afterEach(() => localStorage.clear());

  it('namespaces keys by account', () => {
    expect(storage.key('habiti_projects')).toBe('habiti_projects::6');
  });

  it('keeps two accounts apart', () => {
    storage.write('tasks', ['user six task']);

    auth.currentUserValue = { id: 7 };
    storage.resetMigrationState();

    // The whole point: user 7 must not see user 6's tasks.
    expect(storage.read<string[]>('tasks', [])).toEqual([]);

    storage.write('tasks', ['user seven task']);
    auth.currentUserValue = { id: 6 };
    storage.resetMigrationState();
    expect(storage.read<string[]>('tasks', [])).toEqual(['user six task']);
  });

  it('files signed-out data under guest', () => {
    auth.currentUserValue = null;
    expect(storage.key('tasks')).toBe('tasks::guest');
  });

  it('returns the fallback for a missing or corrupt value', () => {
    expect(storage.read('nothing-here', 'fallback')).toBe('fallback');
    localStorage.setItem('broken::6', '{not json');
    expect(storage.read('broken', 'fallback')).toBe('fallback');
  });

  describe('adopting pre-namespacing data', () => {
    it('gives legacy global data to the first signed-in account', () => {
      // Losing someone's habit history to a refactor is worse than one
      // imperfect adoption — there is no record of whose it was.
      localStorage.setItem('habiti_projects', JSON.stringify(['old project']));

      expect(storage.read<string[]>('habiti_projects', [])).toEqual(['old project']);
      expect(localStorage.getItem('habiti_projects::6')).toBeTruthy();
    });

    it('removes the legacy key so the NEXT account cannot inherit it too', () => {
      localStorage.setItem('habiti_projects', JSON.stringify(['old project']));
      storage.read<string[]>('habiti_projects', []);

      expect(localStorage.getItem('habiti_projects')).toBeNull();

      auth.currentUserValue = { id: 7 };
      storage.resetMigrationState();
      expect(storage.read<string[]>('habiti_projects', [])).toEqual([]);
    });

    it('never lets a signed-out visitor adopt an account\'s data', () => {
      localStorage.setItem('habiti_projects', JSON.stringify(['private']));
      auth.currentUserValue = null;
      storage.resetMigrationState();

      expect(storage.read<string[]>('habiti_projects', [])).toEqual([]);
      // And it is still there for the real owner when they sign in.
      expect(localStorage.getItem('habiti_projects')).toBeTruthy();
    });

    it('does not overwrite data the account already has', () => {
      localStorage.setItem('habiti_projects::6', JSON.stringify(['mine']));
      localStorage.setItem('habiti_projects', JSON.stringify(['someone else']));

      expect(storage.read<string[]>('habiti_projects', [])).toEqual(['mine']);
    });

    it('migrates a key only once per session', () => {
      localStorage.setItem('tasks', JSON.stringify(['first']));
      expect(storage.read<string[]>('tasks', [])).toEqual(['first']);

      storage.write('tasks', ['edited']);
      localStorage.setItem('tasks', JSON.stringify(['stale global']));

      // A second migration would clobber the edit with the stale global value.
      expect(storage.read<string[]>('tasks', [])).toEqual(['edited']);
    });
  });

  it('reads and writes raw strings for non-JSON values', () => {
    storage.writeRaw('theme', 'dark');
    expect(storage.readRaw('theme')).toBe('dark');
    expect(localStorage.getItem('theme::6')).toBe('dark');
  });

  it('removes only this account\'s copy', () => {
    storage.write('tasks', ['mine']);
    auth.currentUserValue = { id: 7 };
    storage.resetMigrationState();
    storage.write('tasks', ['theirs']);

    storage.remove('tasks');
    expect(storage.read<string[]>('tasks', [])).toEqual([]);

    auth.currentUserValue = { id: 6 };
    storage.resetMigrationState();
    expect(storage.read<string[]>('tasks', [])).toEqual(['mine']);
  });
});
