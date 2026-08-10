import { Observable, of } from 'rxjs';
import { ChallengeRun } from '../models/challenge.models';

/**
 * Where challenge runs are stored.
 *
 * This interface is the entire cost of unifying solo challenges with partnered
 * campaigns. A `ChallengeRun` is shaped field-for-field like a `campaigns` row,
 * so when the campaign tables exist the Baserow implementation drops in and
 * moves data — not logic. Nothing above this line knows a campaign table id.
 */
export interface ChallengeRunRepository {
  list(userId: string): Observable<ChallengeRun[]>;
  save(run: ChallengeRun): Observable<ChallengeRun>;
  remove(runId: string): Observable<void>;
}

const STORAGE_KEY = 'habiti-challenge-runs';

/**
 * The Phase 2 implementation. Runs live in localStorage, which is honest for a
 * solo challenge — there is no second party who needs to see them.
 */
export class LocalChallengeRunRepository implements ChallengeRunRepository {
  list(userId: string): Observable<ChallengeRun[]> {
    return of(this.readAll().filter(run => run.ownerUserId === userId));
  }

  save(run: ChallengeRun): Observable<ChallengeRun> {
    const all = this.readAll();
    const index = all.findIndex(r => r.id === run.id);
    if (index >= 0) all[index] = run;
    else all.push(run);
    this.writeAll(all);
    return of(run);
  }

  remove(runId: string): Observable<void> {
    this.writeAll(this.readAll().filter(r => r.id !== runId));
    return of(undefined);
  }

  private readAll(): ChallengeRun[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as ChallengeRun[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeAll(runs: ChallengeRun[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    } catch {
      // Non-fatal: the run still works for this session.
    }
  }
}
