import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BaserowService } from './baserow.service';
import { ChallengeRunRepository } from './challenge-run.repository';
import { ChallengeParticipant, ChallengeRun, ChallengeTerms } from '../models/challenge.models';

interface Tables {
  campaigns: number;
  participants: number;
  reports: number;
}

interface CampaignRow {
  id: number;
  campaign_key: string;
  title: string;
  description?: string;
  type?: string | { value: string };
  status?: string | { value: string };
  owner_user_id: string;
  owner_name?: string;
  cadence?: string | { value: string };
  starts_on?: string;
  ends_on?: string;
  timezone?: string;
  locked_rules_json?: string;
  outcome?: string | { value: string };
}

interface ParticipantRow {
  id: number;
  campaign_key: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_avatar_url?: string;
  role?: string | { value: string };
  invite_status?: string | { value: string };
}

interface ReportRow {
  id: number;
  campaign_key: string;
  user_id: string;
  period_key: string;
}

/**
 * Challenge runs stored as campaign rows — the unification, made real.
 *
 * A run IS a `campaigns` row of type 'challenge'. Solo vs partnered is decided
 * purely by how many `campaign_participants` rows point at it. Check-ins are
 * `campaign_reports` rows, one per participant per period, which is what makes
 * a partner's progress visible at all.
 *
 * The shape a caller sees is identical to the localStorage repository's, so
 * swapping between them moves data, not logic.
 */
export class BaserowChallengeRunRepository implements ChallengeRunRepository {
  constructor(private baserow: BaserowService, private tables: Tables) {}

  list(userId: string): Observable<ChallengeRun[]> {
    // Entry point is participation, not ownership — otherwise a run someone
    // invited you to would be invisible.
    return this.baserow
      .listAllRows<ParticipantRow>(this.tables.participants, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .pipe(
        switchMap(mine => {
          const keys = [...new Set((mine ?? []).map(p => p.campaign_key).filter(Boolean))];
          if (keys.length === 0) return of([] as ChallengeRun[]);

          return forkJoin({
            campaigns: this.byKeys<CampaignRow>(this.tables.campaigns, keys),
            participants: this.byKeys<ParticipantRow>(this.tables.participants, keys),
            reports: this.byKeys<ReportRow>(this.tables.reports, keys)
          }).pipe(map(data => this.assemble(data, keys)));
        }),
        catchError(err => {
          console.warn('BaserowChallengeRunRepository: could not load runs.', err);
          return of([] as ChallengeRun[]);
        })
      );
  }

  save(run: ChallengeRun): Observable<ChallengeRun> {
    const campaign = this.toCampaignRow(run);

    const campaignWrite = run.rowId
      ? this.baserow.updateRow<CampaignRow>(this.tables.campaigns, run.rowId, campaign)
      : this.baserow.createRow<CampaignRow>(this.tables.campaigns, campaign);

    return campaignWrite.pipe(
      switchMap(row => {
        const rowId = row?.id ?? run.rowId;

        const writes: Observable<unknown>[] = [];

        /**
         * Participant rows: create the missing ones, UPDATE the existing ones.
         *
         * The update half is not optional. `invite_status` lives on this table,
         * not on the campaign — so accepting an invite wrote nothing at all
         * until this existed, the campaign PATCH returned 200, and the invite
         * came straight back on reload.
         */
        for (const participant of run.participants ?? []) {
          const data = this.toParticipantRow(run, participant);
          writes.push(
            participant.rowId
              ? this.baserow.updateRow(this.tables.participants, participant.rowId, data)
              : this.baserow.createRow(this.tables.participants, data)
          );
        }

        // Check-ins are NOT written here — they go through addCheckIn() as
        // append-only report rows, so two people checking in on the same day
        // cannot overwrite each other.

        return writes.length ? forkJoin(writes).pipe(map(() => ({ ...run, rowId }))) : of({ ...run, rowId });
      }),
      catchError(err => {
        console.warn('BaserowChallengeRunRepository: could not save the run.', err);
        return of(run);
      })
    );
  }

  /**
   * Records one check-in as a report row.
   *
   * Separate from save() because a check-in is an append, not a rewrite — two
   * people checking in on the same day must not overwrite each other.
   */
  addCheckIn(run: ChallengeRun, userId: string, periodKey: string): Observable<void> {
    return this.baserow
      .createRow(this.tables.reports, {
        campaign_key: run.campaignKey,
        user_id: String(userId),
        period_key: periodKey,
        period_start: `${periodKey}T00:00:00Z`,
        period_end: `${periodKey}T23:59:59Z`,
        report_status: 'submitted',
        self_claim: 'pass',
        confirm_status: 'auto_confirmed',
        submitted_at: new Date().toISOString()
      })
      .pipe(
        map(() => undefined),
        catchError(err => {
          console.warn('BaserowChallengeRunRepository: could not record the check-in.', err);
          return of(undefined);
        })
      );
  }

  remove(runId: string): Observable<void> {
    // Runs are cancelled, never deleted — a partner should still see what
    // happened. ChallengeService sets status 'cancelled' via save().
    return of(undefined);
  }

  /** Baserow has no IN filter, so OR a batch of equals. */
  private byKeys<T>(tableId: number, keys: string[]): Observable<T[]> {
    if (!tableId || keys.length === 0) return of([] as T[]);

    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += 30) chunks.push(keys.slice(i, i + 30));

    return forkJoin(
      chunks.map(chunk =>
        this.baserow.listAllRows<T>(tableId, {
          filterType: 'OR',
          filters: chunk.map(value => ({ field: 'campaign_key', op: 'equal' as const, value }))
        })
      )
    ).pipe(map(results => results.flat()));
  }

  private assemble(
    data: { campaigns: CampaignRow[]; participants: ParticipantRow[]; reports: ReportRow[] },
    keys: string[]
  ): ChallengeRun[] {
    const runs: ChallengeRun[] = [];

    for (const key of keys) {
      const campaign = data.campaigns.find(c => c.campaign_key === key);
      if (!campaign) continue;

      const rules = parseJson(campaign.locked_rules_json);
      const terms = rules?.terms as ChallengeTerms | undefined;
      if (!terms) continue; // Not one of ours — a hand-made campaign row.

      const participants: ChallengeParticipant[] = data.participants
        .filter(p => p.campaign_key === key)
        .map(p => ({
          userId: p.user_id,
          name: p.user_name || p.user_email || 'Someone',
          email: p.user_email,
          avatarUrl: p.user_avatar_url,
          isOwner: unwrap(p.role) === 'owner',
          inviteStatus: (unwrap(p.invite_status) || 'invited') as ChallengeParticipant['inviteStatus'],
          checkIns: data.reports
            .filter(r => r.campaign_key === key && r.user_id === p.user_id)
            .map(r => r.period_key)
            .sort(),
          rowId: p.id
        }))
        .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

      const owner = participants.find(p => p.isOwner);

      runs.push({
        id: key,
        campaignKey: key,
        templateId: rules?.templateId ?? '',
        title: campaign.title ?? '',
        description: campaign.description ?? '',
        icon: rules?.icon ?? '🏆',
        category: rules?.category ?? 'discipline',
        status: mapStatus(unwrap(campaign.status)),
        ownerUserId: campaign.owner_user_id ?? '',
        cadence: (unwrap(campaign.cadence) as 'daily' | 'weekly') || 'daily',
        startsOn: campaign.starts_on ?? '',
        endsOn: campaign.ends_on ?? '',
        timezone: campaign.timezone ?? 'UTC',
        terms,
        checkIns: owner?.checkIns ?? [],
        outcome: (unwrap(campaign.outcome) as ChallengeRun['outcome']) || 'pending',
        createdAt: '',
        participants,
        rowId: campaign.id,
        participantRowId: owner?.rowId
      });
    }

    return runs;
  }

  private toCampaignRow(run: ChallengeRun): Record<string, unknown> {
    return {
      campaign_key: run.campaignKey,
      title: run.title,
      description: run.description,
      type: 'challenge',
      status: toCampaignStatus(run),
      owner_user_id: run.ownerUserId,
      owner_name: (run.participants ?? []).find(p => p.isOwner)?.name ?? '',
      cadence: run.cadence,
      starts_on: run.startsOn || null,
      ends_on: run.endsOn || null,
      timezone: run.timezone,
      current_rules_version: 1,
      locked_rules_version: 1,
      // Frozen at start: a later catalogue edit cannot change the payout.
      locked_rules_json: JSON.stringify({
        templateId: run.templateId,
        icon: run.icon,
        category: run.category,
        terms: run.terms
      }),
      locked_at: run.createdAt || new Date().toISOString(),
      outcome: run.outcome
    };
  }

  private toParticipantRow(
    run: ChallengeRun,
    participant: ChallengeParticipant
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      campaign_key: run.campaignKey,
      user_id: participant.userId,
      user_name: participant.name,
      user_email: participant.email ?? '',
      user_avatar_url: participant.avatarUrl ?? '',
      role: participant.isOwner ? 'owner' : 'partner',
      invite_status: participant.inviteStatus,
      accepted_rules_version: participant.inviteStatus === 'accepted' ? 1 : 0
    };

    // Only stamped on create — an update must not rewrite when they were asked.
    if (!participant.rowId) data['invited_at'] = new Date().toISOString();

    // Stamped when they accept, and never cleared afterwards.
    if (participant.inviteStatus === 'accepted') data['joined_at'] = new Date().toISOString();

    return data;
  }
}

/** Baserow returns a single-select as an object; everything here wants the value. */
function unwrap(value: string | { value: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'object' ? value.value : value;
}

function parseJson(raw: string | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * The campaigns table has ten statuses; a challenge run has four. A run that
 * is still waiting on a partner is 'invited' there and 'active' here — the
 * owner can already check in.
 */
function mapStatus(status: string): ChallengeRun['status'] {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'forfeited':
      return 'cancelled';
    default:
      return 'active';
  }
}

function toCampaignStatus(run: ChallengeRun): string {
  if (run.status === 'active') {
    return (run.participants ?? []).some(p => !p.isOwner && p.inviteStatus === 'invited')
      ? 'invited'
      : 'active';
  }
  return run.status;
}
