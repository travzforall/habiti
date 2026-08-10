import {
  EvidencePort,
  PracticeEntry,
  canClaim,
  eligibleTier,
  longestStreak,
  nextAction,
  practiceDays,
  requirementProgress,
  tierProgress,
  totalVolume
} from './skill-progress.util';
import { SkillTrack } from '../models/skill.models';
import { SkillDefinition, req, skill, task, tier, project } from '../config/skill-catalogue';

/**
 * The rules that make a skill's numbers honest.
 *
 * Two of these are one-line mistakes that no typecheck can catch and that make
 * the whole ladder meaningless: counting completions instead of days, and
 * failing to clamp to the day the track started.
 */

function track(over: Partial<SkillTrack> = {}): SkillTrack {
  return {
    id: 't1',
    skillKey: 'skl_test',
    skillId: 'test',
    userId: '6',
    status: 'active',
    mode: 'solo',
    startedAt: '2026-08-01',
    tier: 0,
    claims: [],
    habitIds: ['h1', 'h2'],
    taskRefs: [],
    projectRefs: [],
    campaignKeys: [],
    updatedAt: '2026-08-01T00:00:00Z',
    ...over
  };
}

function definition(over: Partial<SkillDefinition> = {}): SkillDefinition {
  return skill({
    id: 'test',
    name: 'Test',
    icon: '🧪',
    description: 'A skill for testing.',
    categoryId: 'body',
    habitIds: ['h1', 'h2'],
    starterTasks: [task('t-one', 'First task', 'x'), task('t-two', 'Second task', 'y')],
    starterProjects: [project('p-one', 'A project', 'x', ['step'])],
    campaignTemplateIds: ['iron-thirty'],
    sortIndex: 1,
    tiers: [
      tier(1, 'first', [req.days(3)]),
      tier(2, 'second', [req.days(5), req.tasks('t-one')]),
      tier(3, 'third', [req.days(10)]),
      tier(4, 'fourth', [req.days(20)]),
      tier(5, 'fifth', [req.days(40)])
    ],
    ...over
  });
}

function port(over: Partial<EvidencePort> & { entries?: PracticeEntry[] } = {}): EvidencePort {
  const entries = over.entries ?? [];
  return {
    entriesFor: ids => entries.filter(e => ids.includes(e.habitId)),
    isTaskComplete: () => false,
    isProjectComplete: () => false,
    completedCampaignTemplateIds: () => [],
    ...over
  };
}

const done = (habitId: string, date: string, value?: number): PracticeEntry => ({
  habitId,
  date,
  completed: true,
  ...(value !== undefined ? { value } : {})
});

describe('skill progress', () => {
  describe('practice days', () => {
    it('counts DISTINCT DATES, not completions', () => {
      // The whole point. Six bound habits ticked on Monday is ONE day of
      // practice toward the skill, and counting six would let someone reach
      // tier 3 in an afternoon.
      const p = port({
        entries: [done('h1', '2026-08-02'), done('h2', '2026-08-02'), done('h1', '2026-08-03')]
      });
      expect(practiceDays(track(), p)).toBe(2);
    });

    it('ignores anything before the track started', () => {
      // Without the clamp, starting a skill hands you tiers off past history.
      const p = port({
        entries: [
          done('h1', '2026-07-01'),
          done('h1', '2026-07-15'),
          done('h1', '2026-08-02')
        ]
      });
      expect(practiceDays(track({ startedAt: '2026-08-01' }), p)).toBe(1);
    });

    it('counts the start day itself', () => {
      const p = port({ entries: [done('h1', '2026-08-01')] });
      expect(practiceDays(track({ startedAt: '2026-08-01' }), p)).toBe(1);
    });

    it('ignores habits the track is not bound to', () => {
      const p = port({ entries: [done('h1', '2026-08-02'), done('other', '2026-08-03')] });
      expect(practiceDays(track(), p)).toBe(1);
    });

    it('ignores incomplete entries', () => {
      const p = port({
        entries: [{ habitId: 'h1', date: '2026-08-02', completed: false }, done('h1', '2026-08-03')]
      });
      expect(practiceDays(track(), p)).toBe(1);
    });

    it('narrows to specific habits when a requirement names them', () => {
      const p = port({ entries: [done('h1', '2026-08-02'), done('h2', '2026-08-03')] });
      expect(practiceDays(track(), p, ['h1'])).toBe(1);
    });

    it('ignores a named habit the user never bound', () => {
      // A requirement over an unbound habit must count nothing rather than
      // reading entries the track has no claim to.
      const p = port({ entries: [done('other', '2026-08-02')] });
      expect(practiceDays(track(), p, ['other'])).toBe(0);
    });
  });

  describe('streaks', () => {
    it('finds the longest run of consecutive days', () => {
      const p = port({
        entries: [
          done('h1', '2026-08-01'),
          done('h1', '2026-08-02'),
          done('h1', '2026-08-03'),
          done('h1', '2026-08-06')
        ]
      });
      expect(longestStreak(track(), p)).toBe(3);
    });

    it('treats two habits on the same day as one day of the streak', () => {
      const p = port({
        entries: [done('h1', '2026-08-01'), done('h2', '2026-08-01'), done('h1', '2026-08-02')]
      });
      expect(longestStreak(track(), p)).toBe(2);
    });

    it('crosses a month boundary', () => {
      const p = port({ entries: [done('h1', '2026-08-31'), done('h1', '2026-09-01')] });
      expect(longestStreak(track({ startedAt: '2026-08-01' }), p)).toBe(2);
    });

    it('is zero with no practice', () => {
      expect(longestStreak(track(), port())).toBe(0);
    });
  });

  describe('volume', () => {
    it('sums what the habits measured', () => {
      const p = port({
        entries: [done('h1', '2026-08-01', 100), done('h1', '2026-08-02', 102.5)]
      });
      expect(totalVolume(track(), p)).toBe(202.5);
    });

    it('treats a missing value as zero rather than breaking the sum', () => {
      const p = port({ entries: [done('h1', '2026-08-01', 50), done('h1', '2026-08-02')] });
      expect(totalVolume(track(), p)).toBe(50);
    });

    it('is clamped to the start date like everything else', () => {
      const p = port({ entries: [done('h1', '2026-07-01', 999), done('h1', '2026-08-02', 10)] });
      expect(totalVolume(track({ startedAt: '2026-08-01' }), p)).toBe(10);
    });
  });

  describe('requirements', () => {
    it('reports task requirements against the bound task ids', () => {
      const p = port({ isTaskComplete: id => id === 'task-1' });
      const t = track({ taskRefs: [{ key: 't-one', taskId: 'task-1' }, { key: 't-two', taskId: 'task-2' }] });

      const progress = requirementProgress(req.tasks('t-one', 't-two'), t, definition(), p);
      expect(progress.have).toBe(1);
      expect(progress.need).toBe(2);
      expect(progress.done).toBe(false);
    });

    it('counts an unbound task as not done rather than throwing', () => {
      const progress = requirementProgress(req.tasks('t-one'), track(), definition(), port());
      expect(progress.done).toBe(false);
    });

    it('reports a project requirement by its title', () => {
      const p = port({ isProjectComplete: id => id === 'p1' });
      const t = track({ projectRefs: [{ key: 'p-one', projectId: 'p1' }] });

      const progress = requirementProgress(req.project('p-one'), t, definition(), p);
      expect(progress.label).toBe('A project');
      expect(progress.done).toBe(true);
    });

    it('counts a campaign only when a COMPLETED run matches', () => {
      const t = track({ campaignKeys: ['chl_1'] });
      const finished = port({ completedCampaignTemplateIds: () => ['iron-thirty'] });
      const abandoned = port({ completedCampaignTemplateIds: () => [] });

      expect(requirementProgress(req.campaign('iron-thirty'), t, definition(), finished).done).toBe(true);
      expect(requirementProgress(req.campaign('iron-thirty'), t, definition(), abandoned).done).toBe(false);
    });
  });

  describe('tiers', () => {
    it('is met only when every requirement is', () => {
      const p = port({ entries: [done('h1', '2026-08-01'), done('h1', '2026-08-02')] });
      const def = definition();

      expect(tierProgress(def.tiers[0], track(), def, p).met).toBe(false);
    });

    it('reports a fraction across requirements for the meter', () => {
      const p = port({ entries: [done('h1', '2026-08-01'), done('h1', '2026-08-02')] });
      const def = definition();
      // Tier 2 wants 5 days and one task: 2/5 and 0/1 → 0.2 average.
      expect(tierProgress(def.tiers[1], track(), def, p).fraction).toBeCloseTo(0.2, 5);
    });

    it('awards the highest tier whose requirements are all met', () => {
      const dates = ['01', '02', '03', '04', '05'].map(d => done('h1', `2026-08-${d}`));
      const t = track({ taskRefs: [{ key: 't-one', taskId: 'task-1' }] });
      const p = port({ entries: dates, isTaskComplete: () => true });

      expect(eligibleTier(t, definition(), p)).toBe(2);
    });

    it('STOPS at the first unmet tier rather than skipping a rung', () => {
      // Tier 2 needs a task; without it, ten practice days must not grant
      // tier 3 just because its day count is satisfied.
      const dates = Array.from({ length: 12 }, (_, i) =>
        done('h1', `2026-08-${String(i + 1).padStart(2, '0')}`)
      );
      const p = port({ entries: dates, isTaskComplete: () => false });

      expect(eligibleTier(track(), definition(), p)).toBe(1);
    });

    it('is zero with no evidence at all', () => {
      expect(eligibleTier(track(), definition(), port())).toBe(0);
    });
  });

  describe('next action', () => {
    it('suggests the outstanding requirement closest to done', () => {
      const t = track({ tier: 1, taskRefs: [{ key: 't-one', taskId: 'task-1' }] });
      const p = port({
        entries: [done('h1', '2026-08-01'), done('h1', '2026-08-02'), done('h1', '2026-08-03')],
        isTaskComplete: () => false
      });

      // Tier 2: 3/5 days (0.6) vs 0/1 task (0) — days is closer.
      expect(nextAction(t, definition(), p)!.label).toBe('Practice days');
    });

    it('returns nothing once the ladder is finished', () => {
      expect(nextAction(track({ tier: 5 }), definition(), port())).toBeNull();
    });
  });

  describe('claiming', () => {
    it('is claimable when eligibility exceeds the claimed tier', () => {
      const p = port({
        entries: [done('h1', '2026-08-01'), done('h1', '2026-08-02'), done('h1', '2026-08-03')]
      });
      expect(canClaim(track({ tier: 0 }), definition(), p)).toBe(true);
      expect(canClaim(track({ tier: 1 }), definition(), p)).toBe(false);
    });

    it('is never claimable on a paused track', () => {
      const p = port({
        entries: [done('h1', '2026-08-01'), done('h1', '2026-08-02'), done('h1', '2026-08-03')]
      });
      expect(canClaim(track({ status: 'paused' }), definition(), p)).toBe(false);
    });
  });
});
