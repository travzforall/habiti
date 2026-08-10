import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SkillsService } from './skills.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ChallengeService } from './challenge.service';
import { HabitsService } from './habits';
import { ProjectsService } from './projects.service';
import { SubscriptionService } from './subscription.service';
import { SyncBus } from '@habiti/sync';
import { TasksService } from './tasks.service';
import { ToastService } from './toast.service';
import { UserStorage } from '@habiti/storage';
import { skillDefinition } from '../config/skill-catalogue';

/**
 * The behaviours that are invisible from the UI until they are wrong.
 *
 * Chief among them: a skill silently failing to bind a habit the user already
 * tracks, which shows up only as a progress bar that never moves.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockSubscription {
  plan: 'free' | 'plus' = 'plus';
  allows = (required: string) => (required === 'plus' ? this.plan === 'plus' : true);
}

class MockHabits {
  // Entries are a Map keyed `${habitId}-${date}`, as HabitsService stores them.
  habitEntries = signal(new Map<string, any>());
  habits = signal<any[]>([]);
}

class MockTasks {
  tasksById = new Map<string, { completed: boolean }>();
  getTask = (id: string) => this.tasksById.get(id);
}

class MockProjects {
  projects = signal<any[]>([]);
}

class MockChallenges {
  runs = signal<any[]>([]);
}

class MockToast {
  success = jasmine.createSpy('success');
  info = jasmine.createSpy('info');
  warning = jasmine.createSpy('warning');
  error = jasmine.createSpy('error');
}

class MockBaserow {
  tables = { userSkills: 0 };
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
}

class MockStorage {
  values = new Map<string, string>();
  readRaw = (key: string) => this.values.get(key) ?? null;
  writeRaw = (key: string, value: string) => void this.values.set(key, value);
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      SkillsService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: SubscriptionService, useClass: MockSubscription },
      { provide: HabitsService, useClass: MockHabits },
      { provide: TasksService, useClass: MockTasks },
      { provide: ProjectsService, useClass: MockProjects },
      { provide: ChallengeService, useClass: MockChallenges },
      { provide: ToastService, useClass: MockToast },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  return {
    service: TestBed.inject(SkillsService),
    habits: TestBed.inject(HabitsService) as unknown as MockHabits,
    tasks: TestBed.inject(TasksService) as unknown as MockTasks,
    toast: TestBed.inject(ToastService) as unknown as MockToast,
    subscription: TestBed.inject(SubscriptionService) as unknown as MockSubscription
  };
}

/** Adds completed entries for a habit on the given dates. */
function completeOn(habits: MockHabits, habitId: string, dates: string[]): void {
  const next = new Map(habits.habitEntries());
  for (const date of dates) {
    next.set(`${habitId}-${date}`, { habitId, date, status: 'completed', value: 100 });
  }
  habits.habitEntries.set(next);
}

describe('SkillsService', () => {
  afterEach(() => localStorage.clear());

  describe('starting', () => {
    it('creates a track for a catalogue skill', () => {
      const { service } = build();
      const track = service.start(skillDefinition('strength'));

      expect(track).toBeTruthy();
      expect(service.tracks().length).toBe(1);
      expect(service.trackFor('strength')?.skillId).toBe('strength');
    });

    it('refuses without Habiti Plus, and says why', () => {
      const { service, subscription, toast } = build();
      subscription.plan = 'free';

      expect(service.start(skillDefinition('strength'))).toBeNull();
      expect(service.tracks().length).toBe(0);
      expect(toast.warning).toHaveBeenCalled();
    });

    it('binds the habit ids the caller pre-matched', () => {
      // The page does the name matching, because that is where the catalogue
      // and habit library are already imported — keeping them out of this
      // service is what stops ~110 kB landing in the initial bundle.
      const { service } = build();
      const track = service.start(skillDefinition('strength'), ['77', '77', '88'])!;

      expect(track.habitIds.sort()).toEqual(['77', '88']);
    });

    it('does not start the same skill twice', () => {
      const { service, toast } = build();
      service.start(skillDefinition('guitar'));
      service.start(skillDefinition('guitar'));

      expect(service.tracks().length).toBe(1);
      expect(toast.info).toHaveBeenCalled();
    });

    it('records the mode the user chose', () => {
      const { service } = build();
      expect(service.start(skillDefinition('guitar'), [], 'campaign')!.mode).toBe('campaign');
    });
  });

  describe('bindings', () => {
    it('adds habit ids without duplicating them', () => {
      const { service } = build();
      const track = service.start(skillDefinition('guitar'))!;

      service.bindHabits(track.id, ['1', '2']);
      service.bindHabits(track.id, ['2', '3']);

      expect(service.trackFor('guitar')!.habitIds.sort()).toEqual(['1', '2', '3']);
    });

    it('records a campaign and flips the mode', () => {
      const { service } = build();
      const track = service.start(skillDefinition('guitar'))!;

      service.bindCampaign(track.id, 'chl_abc');
      const updated = service.trackFor('guitar')!;

      expect(updated.campaignKeys).toEqual(['chl_abc']);
      expect(updated.mode).toBe('campaign');
    });
  });

  describe('progress', () => {
    it('counts practice days from bound habits only', () => {
      const { service, habits } = build();
      const track = service.start(skillDefinition('strength'), ['77'])!;

      completeOn(habits, '77', [track.startedAt]);
      completeOn(habits, '99', [track.startedAt]);

      expect(service.practiceDayCount(service.trackFor('strength')!)).toBe(1);
    });

    it('sums recorded values into a volume total', () => {
      const { service, habits } = build();
      const track = service.start(skillDefinition('strength'), ['77'])!;

      completeOn(habits, '77', [track.startedAt, '2099-01-01']);

      expect(service.volume(service.trackFor('strength')!)).toBe(200);
    });

    it('offers a ladder of five tiers', () => {
      const { service } = build();
      const track = service.start(skillDefinition('strength'))!;
      expect(service.ladder(track, skillDefinition('strength')).length).toBe(5);
    });
  });

  describe('claiming a tier', () => {
    it('refuses when the requirements are not met, and names the shortfall', () => {
      const { service, toast } = build();
      const track = service.start(skillDefinition('strength'))!;

      service.claimTier(track.id, skillDefinition('strength'));

      expect(service.trackFor('strength')!.tier).toBe(0);
      expect(toast.warning).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('claims when they are, and freezes the evidence', () => {
      const { service, habits } = build();
      const track = service.start(skillDefinition('strength'), ['77'])!;

      // Tier 1 of Strength wants seven practice days.
      const days = Array.from({ length: 7 }, (_, i) => `2099-01-0${i + 1}`);
      completeOn(habits, '77', days);
      service.bindHabits(track.id, ['77']);

      service.claimTier(track.id, skillDefinition('strength'));
      const claimed = service.trackFor('strength')!;

      expect(claimed.tier).toBe(1);
      expect(claimed.claims.length).toBe(1);
      expect(claimed.claims[0].evidence[0].have).toBeGreaterThanOrEqual(7);
    });

    it('is idempotent — a second claim with no new evidence does nothing', () => {
      const { service, habits } = build();
      const track = service.start(skillDefinition('strength'), ['77'])!;
      completeOn(habits, '77', Array.from({ length: 7 }, (_, i) => `2099-01-0${i + 1}`));

      service.claimTier(track.id, skillDefinition('strength'));
      service.claimTier(track.id, skillDefinition('strength'));

      expect(service.trackFor('strength')!.tier).toBe(1);
    });
  });

  describe('lifecycle', () => {
    it('pausing keeps the start date, so it is not a progress reset', () => {
      const { service } = build();
      const track = service.start(skillDefinition('guitar'))!;
      const startedAt = track.startedAt;

      service.pause(track.id);
      service.resume(track.id);

      const resumed = service.trackFor('guitar')!;
      expect(resumed.status).toBe('active');
      expect(resumed.startedAt).toBe(startedAt);
    });

    it('a paused skill is never claimable', () => {
      const { service, habits } = build();
      const track = service.start(skillDefinition('strength'), ['77'])!;
      completeOn(habits, '77', Array.from({ length: 7 }, (_, i) => `2099-01-0${i + 1}`));

      service.pause(track.id);
      expect(service.isClaimable(service.trackFor('strength')!, skillDefinition('strength'))).toBe(false);
    });

    it('abandoning keeps the bindings rather than deleting the user\'s data', () => {
      // The skill is a lens. Closing it must not destroy habits or tasks.
      const { service } = build();
      const track = service.start(skillDefinition('guitar'))!;
      service.bindHabits(track.id, ['1']);

      service.abandon(track.id);

      const abandoned = service.tracks().find(t => t.id === track.id)!;
      expect(abandoned.status).toBe('abandoned');
      expect(abandoned.habitIds).toEqual(['1']);
    });

    it('drops abandoned skills out of the active list', () => {
      const { service } = build();
      const track = service.start(skillDefinition('guitar'))!;
      service.abandon(track.id);

      expect(service.activeTracks().length).toBe(0);
      expect(service.tracks().length).toBe(1);
    });
  });

  describe('local-only mode', () => {
    it('warns once and stays usable when the table id is 0', () => {
      // An empty result from an unconfigured table is byte-identical to "this
      // user has no skills" — it must never clear a populated cache.
      const warn = spyOn(console, 'warn');
      const { service } = build();

      expect(warn).toHaveBeenCalled();
      expect(service.start(skillDefinition('guitar'))).toBeTruthy();
      expect(service.tracks().length).toBe(1);
    });

    it('keeps tracks across a reload through local storage', () => {
      const { service } = build();
      service.start(skillDefinition('guitar'));

      service.reload();

      expect(service.trackFor('guitar')).toBeTruthy();
    });
  });
});
