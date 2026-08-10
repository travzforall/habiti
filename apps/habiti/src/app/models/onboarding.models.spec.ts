import {
  DEFAULT_PREFERENCES,
  GUIDE_VERSION,
  OnboardingRow,
  OnboardingState,
  WIZARD_VERSION,
  emptyOnboardingState,
  fromOnboardingState,
  reviveOnboardingState,
  toOnboardingState
} from './onboarding.models';

function completedState(): OnboardingState {
  return {
    rowId: 7,
    userId: '42',
    status: 'completed',
    wizardVersion: WIZARD_VERSION,
    preferences: {
      displayName: 'Alex',
      focusAreas: ['fitness', 'mind'],
      theme: 'dark',
      defaultDifficulty: 'hard'
    },
    starterHabits: ['back-squat', 'stretch'],
    guideStatus: 'in_progress',
    guideVersion: GUIDE_VERSION,
    guideStepIndex: 4,
    guideStepsSeen: ['welcome', 'today-habits'],
    pageTipsSeen: ['/challenges'],
    completedAt: new Date('2026-08-09T10:12:00.000Z')
  };
}

describe('onboarding.models', () => {
  describe('emptyOnboardingState', () => {
    it('is pending with app defaults', () => {
      const state = emptyOnboardingState('9');

      expect(state.status).toBe('pending');
      expect(state.rowId).toBeNull();
      expect(state.userId).toBe('9');
      expect(state.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(state.guideStatus).toBe('not_started');
    });

    it('does not share the DEFAULT_PREFERENCES object', () => {
      const state = emptyOnboardingState('9');
      state.preferences.focusAreas.push('fitness');

      expect(DEFAULT_PREFERENCES.focusAreas).toEqual([]);
    });
  });

  describe('round trip', () => {
    it('survives state → row → state', () => {
      const original = completedState();
      const written = fromOnboardingState(original);

      const row: OnboardingRow = {
        id: 7,
        user_id: written['user_id'] as string,
        status: written['status'] as string,
        wizard_version: written['wizard_version'] as number,
        preferences: written['preferences'] as string,
        starter_habits: written['starter_habits'] as string,
        guide_status: written['guide_status'] as string,
        guide_version: written['guide_version'] as number,
        guide_step_index: written['guide_step_index'] as number,
        guide_steps_seen: written['guide_steps_seen'] as string,
        page_tips_seen: written['page_tips_seen'] as string,
        completed_at: written['completed_at'] as string
      };

      expect(toOnboardingState(row)).toEqual(original);
    });

    it('does not write an id — Baserow assigns it', () => {
      expect(fromOnboardingState(completedState())['id']).toBeUndefined();
    });

    it('stamps updated_at on every write', () => {
      expect(fromOnboardingState(completedState())['updated_at']).toBeTruthy();
    });
  });

  describe('toOnboardingState', () => {
    const base: OnboardingRow = { id: 1, user_id: '1', status: 'completed' };

    it('resolves an unrecognised status to completed, never pending', () => {
      // Failing safe means not re-nagging someone who already has a row.
      expect(toOnboardingState({ ...base, status: 'garbage' }).status).toBe('completed');
      expect(toOnboardingState({ ...base, status: '' }).status).toBe('completed');
      expect(toOnboardingState({ ...base, status: undefined as unknown as string }).status).toBe(
        'completed'
      );
    });

    it('still honours an explicit pending or skipped', () => {
      expect(toOnboardingState({ ...base, status: 'pending' }).status).toBe('pending');
      expect(toOnboardingState({ ...base, status: 'skipped' }).status).toBe('skipped');
    });

    it('falls back to not_started for an unknown guide status', () => {
      expect(toOnboardingState({ ...base, guide_status: 'nonsense' }).guideStatus).toBe(
        'not_started'
      );
    });

    it('returns defaults for malformed preferences JSON rather than throwing', () => {
      const state = toOnboardingState({ ...base, preferences: '{not json' });

      expect(state.preferences.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(state.preferences.defaultDifficulty).toBe(DEFAULT_PREFERENCES.defaultDifficulty);
      expect(state.preferences.focusAreas).toEqual([]);
    });

    it('survives a JSON array where an object belongs', () => {
      const state = toOnboardingState({ ...base, preferences: '[1,2,3]' });
      expect(state.preferences.focusAreas).toEqual([]);
    });

    it('drops non-string entries from string arrays', () => {
      const state = toOnboardingState({ ...base, starter_habits: '["a", 2, null, "b"]' });
      expect(state.starterHabits).toEqual(['a', 'b']);
    });

    it('treats missing JSON columns as empty', () => {
      const state = toOnboardingState(base);

      expect(state.starterHabits).toEqual([]);
      expect(state.guideStepsSeen).toEqual([]);
      expect(state.pageTipsSeen).toEqual([]);
      expect(state.completedAt).toBeUndefined();
    });
  });

  describe('reviveOnboardingState', () => {
    it('turns a serialised completedAt back into a Date', () => {
      const parsed = JSON.parse(JSON.stringify(completedState())) as OnboardingState;
      const revived = reviveOnboardingState(parsed);

      expect(revived.completedAt instanceof Date).toBe(true);
      expect(revived.completedAt!.toISOString()).toBe('2026-08-09T10:12:00.000Z');
    });

    it('fills in fields a older cached blob is missing', () => {
      const partial = { userId: '5', status: 'completed' } as unknown as OnboardingState;
      const revived = reviveOnboardingState(partial);

      expect(revived.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(revived.guideStepsSeen).toEqual([]);
      expect(revived.guideStatus).toBe('not_started');
      expect(revived.status).toBe('completed');
    });
  });
});
