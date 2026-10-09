/**
 * Comparing plans: which way of doing this looks best, and why.
 *
 * ── WHY A SCORE AT ALL ────────────────────────────────────────────────────
 *
 * Plan A is cheaper, Plan B is faster, Plan C is the one you actually believe
 * will work. Holding three of those in your head is where a decision quietly
 * becomes "whichever I read last". A score puts them in an order.
 *
 * ── AND WHY IT ALWAYS SHOWS ITS WORKING ───────────────────────────────────
 *
 * A number out of 100 with no explanation is worse than no number: it looks
 * objective and cannot be argued with. Every score here comes with the reasons
 * that made it, in plain words, so the person can disagree with the ranking —
 * which is the point. Nothing is decided by this; a plan is CHOSEN by a person,
 * and a chosen plan sits at the top whatever it scored.
 */

export type PlanStatus = 'draft' | 'considering' | 'chosen' | 'rejected';
export type PlanLevel = 'low' | 'medium' | 'high';

export interface ScorablePlan {
  id: string;
  status?: PlanStatus;
  /** What the person thinks of it, 1-5. The heaviest single input. */
  rating?: number;
  /** What it is expected to cost. */
  cost?: number;
  /** How long it takes, in days. */
  durationDays?: number;
  /** How much work it is. */
  effort?: PlanLevel;
  /** How likely it is to go wrong. */
  risk?: PlanLevel;
  /** How sure the person is that the estimates hold, 0-100. */
  confidence?: number;
}

export interface ScoredPlan<T extends ScorablePlan> {
  plan: T;
  /** 0-100. Only ever compared with the other plans in the same list. */
  score: number;
  /** Plain-language reasons, best first. */
  reasons: string[];
  /** Pinned to the top because someone chose it, not because it scored well. */
  chosen: boolean;
}

const LEVEL_SCORE: Record<PlanLevel, number> = { low: 1, medium: 0.5, high: 0 };

/**
 * Scores a plan against its siblings.
 *
 * Cost and duration are scored RELATIVELY — cheapest in the list gets full
 * marks, dearest gets none — because "is £4,000 expensive" has no answer
 * without the alternatives. A field nobody filled in scores neutral rather than
 * zero: leaving the risk box empty must not be the same as calling it risky.
 */
export function scorePlans<T extends ScorablePlan>(plans: readonly T[]): ScoredPlan<T>[] {
  const costs = plans.map(plan => plan.cost).filter((cost): cost is number => cost !== undefined);
  const durations = plans
    .map(plan => plan.durationDays)
    .filter((days): days is number => days !== undefined);

  const scored = plans.map(plan => {
    const parts: { weight: number; value: number; reason?: string }[] = [];

    if (plan.rating !== undefined) {
      const value = clamp01((plan.rating - 1) / 4);
      parts.push({
        weight: 3,
        value,
        reason: plan.rating >= 4 ? `You rated it ${plan.rating}/5` : undefined
      });
    }

    const cheapness = relative(plan.cost, costs, 'low');
    if (cheapness !== undefined) {
      parts.push({
        weight: 2,
        value: cheapness,
        reason: cheapness === 1 && costs.length > 1 ? 'Cheapest of the options' : undefined
      });
    }

    const quickness = relative(plan.durationDays, durations, 'low');
    if (quickness !== undefined) {
      parts.push({
        weight: 1.5,
        value: quickness,
        reason: quickness === 1 && durations.length > 1 ? 'Fastest of the options' : undefined
      });
    }

    if (plan.risk) {
      parts.push({
        weight: 2,
        value: LEVEL_SCORE[plan.risk],
        reason: plan.risk === 'low' ? 'Low risk' : plan.risk === 'high' ? undefined : undefined
      });
    }

    if (plan.effort) {
      parts.push({ weight: 1, value: LEVEL_SCORE[plan.effort] });
    }

    if (plan.confidence !== undefined) {
      parts.push({
        weight: 1.5,
        value: clamp01(plan.confidence / 100),
        reason: plan.confidence >= 80 ? `You are ${plan.confidence}% sure of it` : undefined
      });
    }

    const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
    // Nothing filled in is not a bad plan — it is an unassessed one. 50 keeps
    // it in the middle instead of at the bottom where it would never be read.
    const score =
      totalWeight === 0
        ? 50
        : Math.round(
            (parts.reduce((sum, part) => sum + part.weight * part.value, 0) / totalWeight) * 100
          );

    const reasons = parts
      .filter(part => part.reason)
      .map(part => part.reason as string);

    // The warnings matter more than the praise, so they go first.
    if (plan.risk === 'high') reasons.unshift('High risk');
    if (plan.confidence !== undefined && plan.confidence < 40) {
      reasons.unshift(`Only ${plan.confidence}% confident`);
    }
    if (plan.cost !== undefined && costs.length > 1 && plan.cost === Math.max(...costs)) {
      reasons.push('Dearest of the options');
    }
    if (totalWeight === 0) reasons.push('Nothing filled in yet');

    return {
      plan,
      score,
      reasons,
      chosen: plan.status === 'chosen'
    };
  });

  return sortPlans(scored);
}

/**
 * The order they are shown in.
 *
 * Chosen first — a decision outranks a calculation. Rejected last, kept rather
 * than deleted, because "we looked at this and said no" is worth remembering
 * when someone suggests it again in three weeks.
 */
export function sortPlans<T extends ScorablePlan>(scored: ScoredPlan<T>[]): ScoredPlan<T>[] {
  const rank = (entry: ScoredPlan<T>) =>
    entry.chosen ? 0 : entry.plan.status === 'rejected' ? 2 : 1;

  return [...scored].sort((a, b) => rank(a) - rank(b) || b.score - a.score);
}

/**
 * Where a value sits between the best and worst of its siblings, 0-1.
 *
 * Undefined when there is nothing to compare, so an unscored field is left out
 * of the weighting rather than counted as bad.
 */
function relative(
  value: number | undefined,
  all: readonly number[],
  better: 'low' | 'high'
): number | undefined {
  if (value === undefined || all.length === 0) return undefined;

  const min = Math.min(...all);
  const max = Math.max(...all);
  // Every option the same is no information either way.
  if (min === max) return 0.5;

  const position = (value - min) / (max - min);
  return better === 'low' ? 1 - position : position;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
