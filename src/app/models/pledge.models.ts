/**
 * Stakes — what someone puts up against a challenge, and what happens after.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  HABITI NEVER HOLDS, ESCROWS, OR TRANSFERS MONEY.
 *
 *  A pledge is a DECLARATION OF INTENT. Habiti records what was agreed,
 *  tracks the outcome, and on failure shows a donation link. The user gives
 *  directly to the charity and says so; the other side confirms. There are
 *  deliberately no payment fields anywhere in this file — no card token, no
 *  account reference, no balance. If you find yourself adding one, stop and
 *  read the note in database-schemas/20-campaign-pledges.json first.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type PledgeKind = 'none' | 'non_monetary' | 'charity_donation' | 'peer_prize';

export interface PledgeKindMeta {
  id: PledgeKind;
  label: string;
  description: string;
  icon: string;
  /** Whether the user names an amount. */
  hasAmount: boolean;
}

export const PLEDGE_KIND_META: Record<PledgeKind, PledgeKindMeta> = {
  none: {
    id: 'none',
    label: 'Nothing',
    description: 'Just the levels',
    icon: '—',
    hasAmount: false
  },
  non_monetary: {
    id: 'non_monetary',
    label: 'A forfeit',
    description: 'Something you do, not something you pay',
    icon: '🤝',
    hasAmount: false
  },
  charity_donation: {
    id: 'charity_donation',
    label: 'A donation',
    description: 'Fail, and you give it to charity',
    icon: '💛',
    hasAmount: true
  },
  peer_prize: {
    id: 'peer_prize',
    label: 'A prize',
    description: 'Fail, and it goes to your partner',
    icon: '🎁',
    hasAmount: true
  }
};

export type PledgeBeneficiary = 'iluv_foundation_project_africa' | 'counterparty' | 'other';

/** What the user agreed to put up. Frozen when the run starts. */
export interface ChallengePledge {
  kind: PledgeKind;
  /** Declared only. No funds are held. */
  amount?: number;
  currency: string;
  /** For a forfeit or prize: what it actually is, in the user's words. */
  description?: string;
  beneficiary: PledgeBeneficiary;
  /** Recorded so we can show that the user was told. */
  disclaimerAccepted: boolean;
  rowId?: number;
}

export type SettlementStatus =
  | 'due'
  | 'self_reported_paid'
  | 'counterparty_confirmed'
  | 'waived'
  | 'overdue'
  | 'disputed';

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; tone: string }> = {
  due: { label: 'Due', tone: 'amber' },
  self_reported_paid: { label: 'You marked it done', tone: 'blue' },
  counterparty_confirmed: { label: 'Settled', tone: 'green' },
  waived: { label: 'Waived', tone: 'slate' },
  overdue: { label: 'Overdue', tone: 'red' },
  disputed: { label: 'Disputed', tone: 'red' }
};

/** The obligation created when a staked run is failed or abandoned. */
export interface ChallengeSettlement {
  id: string;
  campaignKey: string;
  runTitle: string;
  debtorUserId: string;
  /** Absent when the beneficiary is the charity. */
  creditorUserId?: string;
  amount?: number;
  currency: string;
  description?: string;
  kind: PledgeKind;
  status: SettlementStatus;
  /** Snapshotted so the agreed destination stays auditable if config changes. */
  donationLinkUrl?: string;
  receiptNote?: string;
  selfReportedAt?: Date;
  confirmedAt?: Date;
  dueBy?: string;
  rowId?: number;
}

export interface SettlementRow {
  id: number;
  campaign_key: string;
  debtor_user_id: string;
  creditor_user_id?: string;
  amount?: number;
  currency?: string;
  settlement_status?: string | { value: string };
  donation_link_url?: string;
  receipt_url?: string;
  receipt_note?: string;
  self_reported_at?: string;
  confirmed_by_user_id?: string;
  confirmed_at?: string;
  due_by?: string;
}

const VALID_STATUSES: SettlementStatus[] = [
  'due',
  'self_reported_paid',
  'counterparty_confirmed',
  'waived',
  'overdue',
  'disputed'
];

export function toSettlement(row: SettlementRow, runTitle = ''): ChallengeSettlement {
  const raw = typeof row.settlement_status === 'object'
    ? row.settlement_status?.value
    : row.settlement_status;

  return {
    id: String(row.id),
    campaignKey: row.campaign_key ?? '',
    runTitle,
    debtorUserId: row.debtor_user_id ?? '',
    creditorUserId: row.creditor_user_id || undefined,
    amount: row.amount ?? undefined,
    currency: row.currency || 'USD',
    description: row.receipt_note || undefined,
    kind: row.creditor_user_id ? 'peer_prize' : 'charity_donation',
    status: VALID_STATUSES.includes(raw as SettlementStatus) ? (raw as SettlementStatus) : 'due',
    donationLinkUrl: row.donation_link_url || undefined,
    receiptNote: row.receipt_note || undefined,
    selfReportedAt: row.self_reported_at ? new Date(row.self_reported_at) : undefined,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    dueBy: row.due_by || undefined,
    rowId: row.id
  };
}

/** Human summary of a pledge, used wherever the stake is shown. */
export function describePledge(pledge: ChallengePledge | undefined): string {
  if (!pledge || pledge.kind === 'none') return 'Nothing staked';

  switch (pledge.kind) {
    case 'charity_donation':
      return pledge.amount
        ? `${pledge.currency} ${pledge.amount} to charity if you miss it`
        : 'A donation to charity if you miss it';
    case 'peer_prize':
      return pledge.amount
        ? `${pledge.currency} ${pledge.amount} to your partner if you miss it`
        : 'A prize to your partner if you miss it';
    case 'non_monetary':
      return pledge.description || 'A forfeit if you miss it';
    default:
      return 'Nothing staked';
  }
}

/**
 * A settlement is only owed when the run was actually lost. Completing or
 * having it voided releases the pledge — levels only go up, and so does
 * nobody's debt.
 */
export function owesSettlement(
  pledge: ChallengePledge | undefined,
  outcome: 'pending' | 'success' | 'failure' | 'void'
): boolean {
  if (!pledge || pledge.kind === 'none') return false;
  return outcome === 'failure';
}
