import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { HabitsService } from './habits';
import { OnboardingService } from './onboarding.service';
import { OnboardingRow, OnboardingState, defaultPreferences } from '../models/onboarding.models';

const TABLE_ID = 9999;
const USER_ID = '42';

function mirrorKey(userId = USER_ID): string {
  return `habiti-onboarding-${userId}`;
}

function completedMirror(userId = USER_ID): Partial<OnboardingState> {
  return {
    rowId: 5,
    userId,
    status: 'completed',
    preferences: defaultPreferences(),
    starterHabits: [],
    guideStatus: 'completed',
    guideStepIndex: -1,
    guideStepsSeen: [],
    pageTipsSeen: []
  };
}

describe('OnboardingService', () => {
  let httpMock: HttpTestingController;
  let habitsStub: {
    habits: ReturnType<typeof signal<{ name: string }[]>>;
    dataLoaded: ReturnType<typeof signal<boolean>>;
  };
  let authStub: { currentUser: BehaviorSubject<unknown>; isAuthenticated: () => boolean };
  let originalTableId: number;

  /**
   * The service reads the table id once, in a field initializer, so it has to
   * be set before the first inject() rather than in a provider.
   */
  function makeService(tableId: number): OnboardingService {
    (environment.baserow.tables as Record<string, number>)['userOnboarding'] = tableId;
    return TestBed.inject(OnboardingService);
  }

  beforeEach(() => {
    originalTableId = environment.baserow.tables.userOnboarding;
    localStorage.removeItem(mirrorKey());

    habitsStub = { habits: signal<{ name: string }[]>([]), dataLoaded: signal(true) };
    authStub = { currentUser: new BehaviorSubject<unknown>(null), isAuthenticated: () => true };

    TestBed.configureTestingModule({
      providers: [
      provideTestUserId(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HabitsService, useValue: habitsStub },
        { provide: AuthService, useValue: authStub }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    (environment.baserow.tables as Record<string, number>)['userOnboarding'] = originalTableId;
    localStorage.removeItem(mirrorKey());
    httpMock.verify();
  });

  function expectListRequest() {
    return httpMock.expectOne(req => req.method === 'GET' && req.url.includes(`/${TABLE_ID}/`));
  }

  describe('the empty-result hazard', () => {
    it('concludes pending only from a real HTTP 200 with no rows', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);

      expect(service.loadState()).toBe('loading');
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      expect(service.loadState()).toBe('loaded');
      expect(service.state()?.status).toBe('pending');
      expect(service.shouldOpen()).toBe(true);
    });

    it('never concludes pending when the table id is 0', () => {
      // This is the trap: BaserowService.skip() would emit an empty result set
      // that looks exactly like "no row for this user".
      const service = makeService(0);
      service.load(USER_ID);

      expect(service.loadState()).toBe('unavailable');
      httpMock.expectNone(() => true);
    });

    it('does not open for an unconfigured table when the user already has habits', () => {
      habitsStub.habits.set([{ name: 'Read' }]);

      const service = makeService(0);
      service.load(USER_ID);

      expect(service.shouldOpen()).toBe(false);
    });

    it('still onboards a genuinely new user when the table is unconfigured', () => {
      // No mirror, no habits — the app's existing first-run signal.
      const service = makeService(0);
      service.load(USER_ID);

      expect(service.shouldOpen()).toBe(true);
    });

    it('waits for the habit fetch before reading emptiness as brand new', () => {
      habitsStub.dataLoaded.set(false);

      const service = makeService(0);
      service.load(USER_ID);

      expect(service.shouldOpen()).toBe(false);
      habitsStub.dataLoaded.set(true);
      expect(service.shouldOpen()).toBe(true);
    });

    it('keeps a completed mirror when the table id is 0', () => {
      localStorage.setItem(mirrorKey(), JSON.stringify(completedMirror()));

      const service = makeService(0);
      service.load(USER_ID);

      expect(service.state()?.status).toBe('completed');
      expect(service.shouldOpen()).toBe(false);
    });

    it('keeps the mirror and does not open on an HTTP error', () => {
      localStorage.setItem(mirrorKey(), JSON.stringify(completedMirror()));

      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush('boom', { status: 500, statusText: 'Server Error' });

      expect(service.loadState()).toBe('unavailable');
      expect(service.state()?.status).toBe('completed');
      expect(service.shouldOpen()).toBe(false);
    });

    it('renders nothing while idle or loading, so the wizard cannot flash', () => {
      const service = makeService(TABLE_ID);
      expect(service.loadState()).toBe('idle');
      expect(service.shouldOpen()).toBe(false);

      service.load(USER_ID);
      expect(service.loadState()).toBe('loading');
      expect(service.shouldOpen()).toBe(false);

      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });
    });
  });

  describe('loading an existing row', () => {
    const row: OnboardingRow = {
      id: 11,
      user_id: USER_ID,
      status: 'completed',
      preferences: '{"focusAreas":["mind"],"theme":"dark","defaultDifficulty":"hard"}',
      guide_status: 'in_progress',
      guide_step_index: 3
    };

    it('filters by user_id using the name form, not the field_ form', () => {
      // The field_ prefix is silently ignored by Baserow and previously returned
      // every row in the table — that is how users read each other's data.
      const service = makeService(TABLE_ID);
      service.load(USER_ID);

      const req = expectListRequest();
      expect(req.request.urlWithParams).toContain('filter__user_id__equal=42');
      // Note `user_field_names=true` legitimately contains `field_`, so match
      // the filter prefix specifically rather than the bare substring.
      expect(req.request.urlWithParams).not.toContain('filter__field_');

      req.flush({ count: 1, next: null, previous: null, results: [row] });
    });

    it('hydrates preferences and guide progress', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 1, next: null, previous: null, results: [row] });

      expect(service.state()?.rowId).toBe(11);
      expect(service.preferences().theme).toBe('dark');
      expect(service.preferences().focusAreas).toEqual(['mind']);
      expect(service.guideStatus()).toBe('in_progress');
      expect(service.guideStepIndex()).toBe(3);
      expect(service.shouldOpen()).toBe(false);
    });

    it('takes the newest row when a race left duplicates', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({
        count: 2,
        next: null,
        previous: null,
        results: [{ ...row, id: 4 }, { ...row, id: 12 }]
      });

      expect(service.state()?.rowId).toBe(12);
    });

    it('mirrors the server row to localStorage', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 1, next: null, previous: null, results: [row] });

      expect(JSON.parse(localStorage.getItem(mirrorKey())!).rowId).toBe(11);
    });
  });

  describe('mode', () => {
    it('is new with no habits and returning with some', () => {
      const service = makeService(0);
      service.load(USER_ID);

      expect(service.mode()).toBe('new');
      habitsStub.habits.set([{ name: 'Read' }]);
      expect(service.mode()).toBe('returning');
    });

    it('is only settled once habits have been fetched', () => {
      habitsStub.dataLoaded.set(false);
      const service = makeService(0);

      expect(service.modeSettled()).toBe(false);
      habitsStub.dataLoaded.set(true);
      expect(service.modeSettled()).toBe(true);
    });
  });

  describe('skip', () => {
    it('writes defaults and a skipped status', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.skip();

      const post = httpMock.expectOne(req => req.method === 'POST');
      expect(post.request.body.status).toBe('skipped');
      expect(JSON.parse(post.request.body.preferences)).toEqual(defaultPreferences());
      expect(JSON.parse(post.request.body.starter_habits)).toEqual([]);
      post.flush({ ...post.request.body, id: 21 });

      expect(service.shouldOpen()).toBe(false);
    });

    it('leaves the guide not_started, because skipping setup is not declining the tour', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.skip();

      const post = httpMock.expectOne(req => req.method === 'POST');
      expect(post.request.body.guide_status).toBe('not_started');
      post.flush({ ...post.request.body, id: 22 });
    });

    it('captures the assigned row id so the next write is an update', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.skip();
      httpMock.expectOne(req => req.method === 'POST').flush({ id: 33 });
      expect(service.state()?.rowId).toBe(33);

      service.markPageTipSeen('/challenges');
      const patch = httpMock.expectOne(req => req.method === 'PATCH');
      expect(patch.request.url).toContain('/33/');
      patch.flush({ id: 33 });
    });
  });

  describe('complete', () => {
    it('stores the chosen preferences and starter habits', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.complete({
        preferences: {
          focusAreas: ['fitness'],
          theme: 'dark',
          defaultDifficulty: 'hard',
          displayName: 'Alex'
        },
        starterHabits: ['back-squat'],
        launchGuide: true
      });

      const post = httpMock.expectOne(req => req.method === 'POST');
      expect(post.request.body.status).toBe('completed');
      expect(post.request.body.guide_status).toBe('not_started');
      expect(JSON.parse(post.request.body.preferences).theme).toBe('dark');
      expect(JSON.parse(post.request.body.starter_habits)).toEqual(['back-squat']);
      post.flush({ ...post.request.body, id: 44 });
    });

    it('marks the guide skipped when the checkbox was unticked', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.complete({
        preferences: defaultPreferences(),
        starterHabits: [],
        launchGuide: false
      });

      const post = httpMock.expectOne(req => req.method === 'POST');
      expect(post.request.body.guide_status).toBe('skipped');
      post.flush({ ...post.request.body, id: 45 });
    });
  });

  describe('guide progress', () => {
    function ready(): OnboardingService {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 7, user_id: USER_ID, status: 'completed' }]
      });
      return service;
    }

    it('coalesces a fast click-through into one PATCH', fakeAsync(() => {
      const service = ready();

      service.recordGuideProgress(0, 'welcome');
      service.recordGuideProgress(1, 'today-habits');
      service.recordGuideProgress(2, 'complete-habit');

      httpMock.expectNone(req => req.method === 'PATCH');
      tick(1200);

      const patch = httpMock.expectOne(req => req.method === 'PATCH');
      expect(patch.request.body.guide_step_index).toBe(2);
      expect(JSON.parse(patch.request.body.guide_steps_seen)).toEqual([
        'welcome',
        'today-habits',
        'complete-habit'
      ]);
      patch.flush({ id: 7 });
    }));

    it('mirrors immediately, so a reload mid-debounce still resumes', fakeAsync(() => {
      const service = ready();
      service.recordGuideProgress(4, 'add-habit');

      expect(JSON.parse(localStorage.getItem(mirrorKey())!).guideStepIndex).toBe(4);

      tick(1200);
      httpMock.expectOne(req => req.method === 'PATCH').flush({ id: 7 });
    }));

    it('writes a finish straight through, without waiting for the debounce', () => {
      const service = ready();
      service.finishGuide('finished');

      const patch = httpMock.expectOne(req => req.method === 'PATCH');
      expect(patch.request.body.guide_status).toBe('completed');
      expect(patch.request.body.guide_step_index).toBe(-1);
      patch.flush({ id: 7 });
    });

    it('cancels a pending debounce when the guide finishes', fakeAsync(() => {
      const service = ready();

      service.recordGuideProgress(2, 'complete-habit');
      service.finishGuide('skipped');

      const patch = httpMock.expectOne(req => req.method === 'PATCH');
      expect(patch.request.body.guide_status).toBe('skipped');
      patch.flush({ id: 7 });

      // The debounced write must not fire a second, stale PATCH afterwards.
      tick(1200);
      expect(httpMock.match(req => req.method === 'PATCH').length).toBe(0);
    }));

    it('does not record the same step id twice', fakeAsync(() => {
      const service = ready();

      service.recordGuideProgress(0, 'welcome');
      service.recordGuideProgress(0, 'welcome');
      tick(1200);

      const patch = httpMock.expectOne(req => req.method === 'PATCH');
      expect(JSON.parse(patch.request.body.guide_steps_seen)).toEqual(['welcome']);
      patch.flush({ id: 7 });
    }));
  });

  describe('page tips', () => {
    it('records a route key once', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 8, user_id: USER_ID, status: 'completed' }]
      });

      expect(service.hasSeenPageTip('/challenges')).toBe(false);
      service.markPageTipSeen('/challenges');
      expect(service.hasSeenPageTip('/challenges')).toBe(true);
      httpMock.expectOne(req => req.method === 'PATCH').flush({ id: 8 });

      service.markPageTipSeen('/challenges');
      httpMock.expectNone(req => req.method === 'PATCH');
    });
  });

  describe('replayWizard', () => {
    it('reopens without discarding stored preferences', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 9,
            user_id: USER_ID,
            status: 'completed',
            preferences: '{"focusAreas":["mind"],"theme":"dark","defaultDifficulty":"hard"}'
          }
        ]
      });

      expect(service.shouldOpen()).toBe(false);
      service.replayWizard();

      expect(service.shouldOpen()).toBe(true);
      expect(service.preferences().theme).toBe('dark');
    });
  });

  describe('reset', () => {
    it('clears state on sign-out', () => {
      const service = makeService(TABLE_ID);
      service.load(USER_ID);
      expectListRequest().flush({ count: 0, next: null, previous: null, results: [] });

      service.reset();

      expect(service.state()).toBeNull();
      expect(service.loadState()).toBe('idle');
      expect(service.shouldOpen()).toBe(false);
    });
  });
});
