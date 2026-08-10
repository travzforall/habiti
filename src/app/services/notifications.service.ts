import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { FriendsService } from './friends.service';
import { ToastService } from './toast.service';

export type NotificationKind =
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_declined'
  | 'challenge_invite'
  | 'challenge_joined'
  | 'challenge_declined'
  | 'settlement_due';

export interface AppNotification {
  /** Stable across reloads — it is what "already seen" is keyed on. */
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  icon: string;
  route: string;
  at: Date;
}

/** Discriminates one occurrence of an event from the next on the same row. */
function stamp(date: Date | undefined): string {
  return date ? String(date.getTime()) : '0';
}

const SEEN_KEY = 'habiti-seen-notifications';
/** Cap the stored set so it cannot grow without bound. */
const MAX_SEEN = 300;

/**
 * The notification bell.
 *
 * There is no push channel, so nothing here is real-time — notifications are
 * *derived* from data the app has already loaded. Open the app, and anything
 * that changed since you last looked shows up. That is a deliberate limit, not
 * an oversight: a genuine push would need a backend.
 *
 * The "seen" set lives in localStorage keyed by a stable id, so dismissing a
 * notification survives a reload and does not re-fire on every poll.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private friends = inject(FriendsService);
  private challenges = inject(ChallengeService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  private readonly _seen = signal<Set<string>>(this.loadSeen());
  /** Toasted this session, so a poll does not re-toast the same thing. */
  private readonly toasted = new Set<string>();
  private baselined = false;

  /** Everything worth telling the user about, newest first. */
  readonly all = computed<AppNotification[]>(() => {
    const me = this.userId();
    const items: AppNotification[] = [];

    // --- Friends ---------------------------------------------------------
    for (const friend of this.friends.incomingRequests()) {
      items.push({
        /**
         * Keyed on WHEN it was sent, not just which row it is.
         *
         * A re-invite revives the same friendship row, so a bare row id makes
         * the second invite identical to the first — and since dismissing (or
         * baselining) writes that id to a persisted seen-set, the row could
         * never notify again. Someone re-inviting you would be silently
         * swallowed, forever.
         */
        id: `friend_request:${friend.friendshipId}:${stamp(friend.invitedAt)}`,
        kind: 'friend_request',
        title: `${friend.name} wants to connect`,
        body: friend.inviteMessage,
        icon: '👋',
        route: '/friends',
        // A pending invite has no `since` — that is the answer timestamp.
        at: friend.invitedAt ?? new Date()
      });
    }

    for (const friend of this.friends.friends()) {
      // Only tell the sender their invite landed — the accepter already knows.
      if (!friend.iInitiated) continue;
      items.push({
        id: `friend_accepted:${friend.friendshipId}:${stamp(friend.since)}`,
        kind: 'friend_accepted',
        title: `${friend.name} accepted your invite`,
        icon: '🤝',
        route: '/friends',
        at: friend.since ?? new Date()
      });
    }

    for (const friend of this.friends.outgoingRequests()) {
      if (friend.status !== 'declined') continue;
      items.push({
        id: `friend_declined:${friend.friendshipId}:${stamp(friend.since)}`,
        kind: 'friend_declined',
        title: `${friend.name} declined your invite`,
        icon: '🙅',
        route: '/friends',
        at: friend.since ?? new Date()
      });
    }

    // --- Challenges ------------------------------------------------------
    for (const run of this.challenges.partnerInvites()) {
      const owner = (run.participants ?? []).find(p => p.isOwner);
      items.push({
        id: `challenge_invite:${run.campaignKey}`,
        kind: 'challenge_invite',
        title: `${owner?.name ?? 'Someone'} invited you to ${run.title}`,
        body: `${run.terms.periodsTotal} check-ins · worth ${run.terms.levelValue} levels`,
        icon: run.icon,
        route: '/challenges',
        at: new Date(run.createdAt || Date.now())
      });
    }

    // A partner answering a challenge I own.
    for (const run of this.challenges.runs()) {
      if (run.ownerUserId !== me) continue;
      for (const p of run.participants ?? []) {
        if (p.isOwner) continue;
        if (p.inviteStatus === 'accepted') {
          items.push({
            id: `challenge_joined:${run.campaignKey}:${p.userId}`,
            kind: 'challenge_joined',
            title: `${p.name} joined ${run.title}`,
            icon: '🎉',
            route: '/challenges',
            at: new Date(run.createdAt || Date.now())
          });
        } else if (p.inviteStatus === 'declined') {
          items.push({
            id: `challenge_declined:${run.campaignKey}:${p.userId}`,
            kind: 'challenge_declined',
            title: `${p.name} passed on ${run.title}`,
            body: "You're still running it solo.",
            icon: '🙅',
            route: '/challenges',
            at: new Date(run.createdAt || Date.now())
          });
        }
      }
    }

    // --- Money owed ------------------------------------------------------
    for (const settlement of this.challenges.openSettlements()) {
      if (settlement.status !== 'due' && settlement.status !== 'overdue') continue;
      items.push({
        id: `settlement_due:${settlement.id}`,
        kind: 'settlement_due',
        title: 'You have something to settle',
        body: settlement.runTitle,
        icon: '💛',
        route: '/challenges',
        at: new Date()
      });
    }

    return items.sort((a, b) => b.at.getTime() - a.at.getTime());
  });

  readonly unread = computed(() => this.all().filter(n => !this._seen().has(n.id)));
  readonly unreadCount = computed(() => this.unread().length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    effect(() => {
      const items = this.all();

      // Wait for real data. The effect first runs at bootstrap before any HTTP
      // response lands, so baselining then would baseline an empty list and
      // the first real load would toast everything.
      if (!this.friends.hydrated() || !this.challenges.hydrated()) return;

      // First run on this device: treat everything already there as seen, or
      // the user gets a wall of toasts for history they have already lived
      // through.
      if (!this.baselined) {
        this.baselined = true;
        if (!this.hasStoredSeen()) {
          this.markAllRead();
          items.forEach(n => this.toasted.add(n.id));
          return;
        }
        items.forEach(n => this.toasted.add(n.id));
        return;
      }

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const item of items) {
        if (this._seen().has(item.id) || this.toasted.has(item.id)) continue;
        this.toasted.add(item.id);
        // Never toast about old history — a stale seen-set would otherwise
        // produce a wall of notifications for things long since dealt with.
        if (item.at.getTime() < weekAgo) continue;
        this.toast.info(item.title, item.body);
      }
    });
  }

  /** Cleared on logout / account switch so the next user starts clean. */
  reset(): void {
    this.toasted.clear();
    this.baselined = false;
    this._seen.set(this.loadSeen());
  }

  markRead(id: string): void {
    this._seen.update(seen => {
      const next = new Set(seen);
      next.add(id);
      return next;
    });
    this.persist();
  }

  markAllRead(): void {
    this._seen.update(seen => {
      const next = new Set(seen);
      this.all().forEach(n => next.add(n.id));
      return next;
    });
    this.persist();
  }

  private persist(): void {
    try {
      // Keep only the newest ids; an unbounded set would grow forever.
      const ids = [...this._seen()].slice(-MAX_SEEN);
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {
      // Dismissals are session-only if storage is unavailable.
    }
  }

  private hasStoredSeen(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) !== null;
    } catch {
      return false;
    }
  }

  private loadSeen(): Set<string> {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private userId(): string {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : '';
  }
}
