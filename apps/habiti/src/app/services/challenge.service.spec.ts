import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ChallengeService } from './challenge.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { HabitsService } from './habits';
import { LevelService } from './level.service';
import { SubscriptionService } from './subscription.service';
import { ToastService } from './toast.service';
import { CHALLENGE_CATALOGUE } from '../config/challenge-catalogue.seed';
import { ChallengeRun, toDateKey } from '../models/challenge.models';

class MockHabitsService {
  // A signal, because the real getTodaysHabitSummary() reads signals
  // internally — that is what makes ChallengeService's computed reactive.
  private summary = signal({ completed: 0, total: 5, habits: [] as any[] });
  getTodaysHabitSummary = () => this.summary();
  setCompleted(completed: number) {
    this.summary.update(s => ({ ...s, completed }));
  }
}

class MockLevelService {
  level = signal(1);
  award = jasmine.createSpy('award').and.returnValue(of(null));
}

class MockSubscriptionService {
  isPaid = signal(false);
  allows = () => true;
}

class MockAuthService {
  currentUserValue = { id: 1, name: 'Testing User', email: 'test@test.com' };
}

class MockBaserowService {
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
  batchCreateRows = jasmine.createSpy('batchCreateRows').and.returnValue(of({ items: [] }));
}

class MockToastService {
  success = jasmine.createSpy('success');
  info = jasmine.createSpy('info');
  warning = jasmine.createSpy('warning');
  error = jasmine.createSpy('error');
}

function build() {
  TestBed.configureTestingModule({
    providers: [
      ChallengeService,
      { provide: AuthService, useClass: MockAuthService },
      { provide: BaserowService, useClass: MockBaserowService },
      { provide: HabitsService, useClass: MockHabitsService },
      { provide: LevelService, useClass: MockLevelService },
      { provide: SubscriptionService, useClass: MockSubscriptionService },
      { provide: ToastService, useClass: MockToastService }
    ]
  });
  return {
    service: TestBed.inject(ChallengeService),
    habits: TestBed.inject(HabitsService) as unknown as MockHabitsService,
    levels: TestBed.inject(LevelService) as unknown as MockLevelService,
    toast: TestBed.inject(ToastService) as unknown as MockToastService
  };
}

const SEVEN_DAY = CHALLENGE_CATALOGUE.find(t => t.id === 'cold-start-7')!;

describe('ChallengeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('starts a run and freezes the tier value into its terms', () => {
    const { service } = build();
    service.start(SEVEN_DAY, 'hard').subscribe();

    const run = service.activeRuns()[0];
    expect(run.terms.levelValue).toBe(12);
    expect(run.terms.difficulty).toBe('hard');
    expect(run.status).toBe('active');
    expect(run.campaignKey.startsWith('chl_')).toBe(true);
  });

  it('refuses to start the same challenge twice', () => {
    const { service, toast } = build();
    service.start(SEVEN_DAY, 'hard').subscribe();
    service.start(SEVEN_DAY, 'easy').subscribe();

    expect(service.activeRuns().length).toBe(1);
    expect(toast.info).toHaveBeenCalled();
  });

  describe('check-in', () => {
    it('is idempotent per day', () => {
      const { service } = build();
      service.start(SEVEN_DAY, 'hard').subscribe();
      const id = service.activeRuns()[0].id;

      service.checkIn(id).subscribe();
      service.checkIn(id).subscribe();
      service.checkIn(id).subscribe();

      expect(service.activeRuns()[0].checkIns.length).toBe(1);
    });

    it('snapshots the habit data behind the claim', () => {
      const { service, habits } = build();
      habits.setCompleted(4);
      service.start(SEVEN_DAY, 'hard').subscribe();
      const id = service.activeRuns()[0].id;

      service.checkIn(id).subscribe();

      const evidence = service.activeRuns()[0].evidence!;
      expect(evidence.length).toBe(1);
      expect(evidence[0].habitsCompleted).toBe(4);
      expect(evidence[0].habitsTotal).toBe(5);
      expect(evidence[0].date).toBe(toDateKey());
    });

    it('records the claim even with no habit data — evidence is shown, not enforced', () => {
      // Challenges cover things Habiti does not track as habits, so a check-in
      // must not be blocked by an empty habit day.
      const { service, habits } = build();
      habits.setCompleted(0);
      service.start(SEVEN_DAY, 'hard').subscribe();
      const id = service.activeRuns()[0].id;

      service.checkIn(id).subscribe();

      expect(service.activeRuns()[0].checkIns.length).toBe(1);
      expect(service.isCheckInBacked(service.activeRuns()[0])).toBe(false);
    });

    it('reports a check-in as backed once enough habits are done', () => {
      const { service, habits } = build();
      service.start(SEVEN_DAY, 'hard').subscribe();
      const run = service.activeRuns()[0];

      habits.setCompleted(0);
      expect(service.isCheckInBacked(run)).toBe(false);

      habits.setCompleted(1);
      expect(service.isCheckInBacked(run)).toBe(true);
    });
  });

  describe('complete', () => {
    it('refuses a run that has not been earned, and awards nothing', () => {
      const { service, levels, toast } = build();
      service.start(SEVEN_DAY, 'hard').subscribe();
      const id = service.activeRuns()[0].id;

      service.checkIn(id).subscribe();
      service.complete(id).subscribe();

      expect(levels.award).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalled();
      expect(service.activeRuns()[0].status).toBe('active');
    });

    it('awards the frozen level value once the run is genuinely finished', () => {
      const { service, levels } = build();
      service.start(SEVEN_DAY, 'hard').subscribe();

      // Force a finished run: seven check-ins, past its end date.
      const run = service.activeRuns()[0];
      const finished: ChallengeRun = {
        ...run,
        startsOn: '2020-01-01',
        endsOn: '2020-01-07',
        checkIns: [
          '2020-01-01', '2020-01-02', '2020-01-03', '2020-01-04',
          '2020-01-05', '2020-01-06', '2020-01-07'
        ]
      };
      (service as any)._runs.set([finished]);

      service.complete(finished.id).subscribe();

      expect(levels.award).toHaveBeenCalled();
      const award = levels.award.calls.mostRecent().args[0];
      expect(award.levels).toBe(12);
      expect(award.source).toBe('challenge');
      expect(award.idempotencyKey).toContain(finished.campaignKey);
    });
  });

  it('abandoning costs nothing — levels only ever go up', () => {
    const { service, levels } = build();
    service.start(SEVEN_DAY, 'hard').subscribe();
    const id = service.activeRuns()[0].id;

    service.abandon(id).subscribe();

    expect(service.activeRuns().length).toBe(0);
    expect(service.finishedRuns()[0].status).toBe('cancelled');
    expect(levels.award).not.toHaveBeenCalled();
  });

  it('persists the default difficulty', () => {
    const { service } = build();
    expect(service.defaultDifficulty()).toBe('medium');

    service.setDefaultDifficulty('hard');
    expect(service.defaultDifficulty()).toBe('hard');
    expect(localStorage.getItem('habiti-default-difficulty')).toBe('hard');
  });

  it('shows catalogue level values at the current default difficulty', () => {
    const { service } = build();
    const entryAt = (id: string) => service.catalogue().find(e => e.template.id === id)!;

    service.setDefaultDifficulty('easy');
    expect(entryAt('cold-start-7').levelValue).toBe(6);

    service.setDefaultDifficulty('hard');
    expect(entryAt('cold-start-7').levelValue).toBe(12);
  });
});
