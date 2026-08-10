/**
 * The level ledger.
 *
 * A user's level is the sum of every award they have ever received, plus 1. It
 * is never stored as a standalone counter — that is exactly the shape that let
 * the old points-derived level silently reset and drift.
 */

import { LevelRefType, LevelSource } from '../utils/level-derivation.util';

export type { LevelRefType, LevelSource };

export const LEVEL_SOURCE_META: Record<LevelSource, { label: string; icon: string }> = {
  challenge: { label: 'Challenge', icon: '🏆' },
  streak: { label: 'Streak', icon: '🔥' },
  achievement: { label: 'Achievement', icon: '⭐' },
  habit_milestone: { label: 'Milestone', icon: '📈' },
  manual: { label: 'Adjustment', icon: '✍️' },
  migration: { label: 'Carried over', icon: '🎁' }
};

/** App-domain shape (string id, Date, camelCase) — mirrors project.model.ts. */
export interface LevelRecord {
  id: string;
  userId: string;
  source: LevelSource;
  levelsAwarded: number;
  levelBefore: number;
  levelAfter: number;
  reason: string;
  detail?: string;
  refType: LevelRefType;
  refKey?: string;
  refId?: number;
  icon?: string;
  idempotencyKey: string;
  occurredAt: Date;
}

/** Baserow row shape (numeric id, ISO strings, snake_case) — mirrors database.models.ts. */
export interface LevelRecordRow {
  id: number;
  user_id: string;
  source: string;
  levels_awarded: number;
  level_before?: number;
  level_after?: number;
  reason: string;
  detail?: string;
  ref_type?: string;
  ref_key?: string;
  ref_id?: number;
  icon?: string;
  idempotency_key: string;
  occurred_at?: string;
}

/** What a caller hands to `LevelService.award()`. */
export interface LevelAward {
  source: LevelSource;
  /** Must be >= 1. Awards below that are rejected — levels only go up. */
  levels: number;
  reason: string;
  detail?: string;
  icon?: string;
  refType?: LevelRefType;
  refKey?: string;
  refId?: number;
  /** `userId:source:refKey`. The guard against a double award. */
  idempotencyKey: string;
  occurredAt?: Date;
}

const VALID_SOURCES: LevelSource[] = [
  'challenge',
  'streak',
  'achievement',
  'habit_milestone',
  'manual',
  'migration'
];

export function toLevelRecord(row: LevelRecordRow): LevelRecord {
  const source = VALID_SOURCES.includes(row.source as LevelSource)
    ? (row.source as LevelSource)
    : 'manual';

  return {
    id: String(row.id),
    userId: row.user_id ?? '',
    source,
    levelsAwarded: Math.max(0, Math.floor(row.levels_awarded ?? 0)),
    levelBefore: row.level_before ?? 0,
    levelAfter: row.level_after ?? 0,
    reason: row.reason ?? '',
    detail: row.detail || undefined,
    refType: (row.ref_type as LevelRefType) || 'none',
    refKey: row.ref_key || undefined,
    refId: row.ref_id ?? undefined,
    icon: row.icon || LEVEL_SOURCE_META[source].icon,
    idempotencyKey: row.idempotency_key ?? '',
    occurredAt: row.occurred_at ? new Date(row.occurred_at) : new Date(0)
  };
}

export function fromLevelRecord(record: Omit<LevelRecord, 'id'>): Record<string, unknown> {
  return {
    user_id: record.userId,
    source: record.source,
    levels_awarded: record.levelsAwarded,
    level_before: record.levelBefore,
    level_after: record.levelAfter,
    reason: record.reason,
    detail: record.detail ?? '',
    ref_type: record.refType,
    ref_key: record.refKey ?? '',
    ref_id: record.refId ?? null,
    icon: record.icon ?? '',
    idempotency_key: record.idempotencyKey,
    occurred_at: record.occurredAt.toISOString()
  };
}

/** Round-trips through localStorage, where Dates arrive back as strings. */
export function reviveLevelRecord(raw: LevelRecord): LevelRecord {
  return { ...raw, occurredAt: new Date(raw.occurredAt) };
}
