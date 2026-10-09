import { toMinor } from './money';

/**
 * What a tool costs, which depends entirely on how you are getting it.
 *
 * ── WHY A TOOL IS NOT AN ITEM ─────────────────────────────────────────────
 *
 * An item is consumed: ten bags of Quikrete cost what they cost and then they
 * are gone. A tool is used and handed back, and the same drill can serve six
 * jobs for nothing. Four states, four different consequences:
 *
 *   own     — it is in the shed. Costs nothing, ever.
 *   borrow  — someone is lending it. Costs nothing, but it has to go back.
 *   hire    — rate × days.
 *   buy     — a one-off cost.
 *
 * A list that cannot tell these apart cannot answer the only two questions
 * worth asking: what do I still have to get hold of, and what will it cost?
 */

export type ToolStatus = 'own' | 'borrow' | 'hire' | 'buy';

export interface CostedTool {
  id: string;
  status: ToolStatus;
  purchaseCost?: number;
  hireRate?: number;
  hireDays?: number;
  inHand?: boolean;
  neededBy?: Date;
  returnBy?: Date;
}

/** The cost in minor units. Zero for anything already owned or lent. */
export function toolCostMinor(tool: CostedTool): number {
  switch (tool.status) {
    case 'buy':
      return toMinor(tool.purchaseCost);
    case 'hire': {
      // A hire with no days named is still a day's hire, not a free one.
      const days = tool.hireDays && tool.hireDays > 0 ? tool.hireDays : 1;
      return Math.round(toMinor(tool.hireRate) * days);
    }
    default:
      return 0;
  }
}

export function toolCost(tool: CostedTool): number {
  return toolCostMinor(tool) / 100;
}

/**
 * What a job still has to lay hands on.
 *
 * `own` never appears — it is already here. Everything else does until it is
 * marked in hand, INCLUDING a hired tool, because "booked" and "collected" are
 * not the same thing on the morning the work starts.
 */
export function stillToGet<T extends CostedTool>(tools: readonly T[]): T[] {
  return tools.filter(tool => tool.status !== 'own' && !tool.inHand);
}

/**
 * What the tools add to a budget.
 *
 * A hired tool goes on costing after it arrives — the money is owed for the
 * hire, not for the collection — so `inHand` does not clear it. A bought tool
 * that is in hand HAS been paid for, and should be an expense by then, so
 * counting it here as well would double it.
 */
export function toolsCommittedMinor(tools: readonly CostedTool[]): number {
  return tools
    .filter(tool => !(tool.status === 'buy' && tool.inHand))
    .reduce((total, tool) => total + toolCostMinor(tool), 0);
}

/** Anything borrowed or hired that has to go back, soonest first. */
export function toReturn<T extends CostedTool>(tools: readonly T[]): T[] {
  return tools
    .filter(tool => (tool.status === 'borrow' || tool.status === 'hire') && tool.returnBy)
    .sort((a, b) => (a.returnBy as Date).getTime() - (b.returnBy as Date).getTime());
}

/** Tools needed by a date that has already gone, and still not here. */
export function overdueTools<T extends CostedTool>(
  tools: readonly T[],
  today = new Date()
): T[] {
  return stillToGet(tools).filter(
    tool => tool.neededBy && tool.neededBy.getTime() < today.getTime()
  );
}
