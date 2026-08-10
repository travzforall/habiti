import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ToastService } from './toast.service';
import { SyncBus } from './sync-public-api';
import { OutboundEvent } from '@habiti/realtime-protocol';
import {
  Friend,
  Friendship,
  FriendshipRow,
  fromFriendship,
  isValidEmail,
  normalizeEmail,
  pairKeyFor,
  toFriend,
  toFriendship
} from '../models/friend.models';

/**
 * The social graph: invites out, invites in, and accepted friends.
 *
 * Invites are addressed by email because no user-search endpoint exists. That
 * means an invite can be sent to someone who has not signed up yet — the row
 * simply sits in `pending` until an account with that email opens the app.
 */
@Injectable({ providedIn: 'root' })
export class FriendsService {
  private baserow = inject(BaserowService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private bus = inject(SyncBus);

  private readonly tableId = environment.baserow.tables.friendships;

  private readonly _friendships = signal<Friendship[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly friendships = this._friendships.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Accepted, direction-normalized so the UI never asks "am I the requester?". */
  readonly friends = computed<Friend[]>(() =>
    this._friendships()
      .filter(f => f.status === 'accepted')
      .map(f => toFriend(f, this.userId(), this.email()))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  /** Waiting on me. */
  readonly incomingRequests = computed<Friend[]>(() =>
    this._friendships()
      .filter(f => f.status === 'pending' && f.addresseeEmail === this.email())
      .map(f => toFriend(f, this.userId(), this.email()))
  );

  /**
   * Invites I sent — including ones that have been answered.
   *
   * Resolved invites are kept deliberately. Filtering to `pending` made a
   * declined request vanish from the sender's view with no trace, so they never
   * found out what happened. Pending first, then the answers.
   */
  readonly outgoingRequests = computed<Friend[]>(() => {
    const order: Record<string, number> = { pending: 0, accepted: 1, declined: 2, cancelled: 3, blocked: 4 };
    return this._friendships()
      .filter(f => f.requesterUserId === this.userId() && f.status !== 'accepted')
      .map(f => toFriend(f, this.userId(), this.email()))
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  });

  /** Still genuinely waiting on the other person. */
  readonly pendingOutgoing = computed(() =>
    this.outgoingRequests().filter(f => f.status === 'pending')
  );

  readonly incomingCount = computed(() => this.incomingRequests().length);

  constructor() {
    this.load();
  }

  /** True once the first load has settled — success or handled failure. */
  private readonly _hydrated = signal(false);
  readonly hydrated = this._hydrated.asReadonly();

  /**
   * Reloads the social graph and completes.
   *
   * `load()` below keeps its void signature so existing callers (the
   * constructor, the Friends page button) are untouched.
   */
  refresh(): Observable<void> {
    return new Observable<void>(observer => {
      const done = () => {
        observer.next();
        observer.complete();
      };
      this.loadInternal(done);
    });
  }

  reset(): void {
    this._friendships.set([]);
    this._error.set(null);
    this._loading.set(false);
    this._hydrated.set(false);
  }

  load(): void {
    this.loadInternal();
  }

  private loadInternal(done?: () => void): void {
    if (!this.tableId) {
      console.warn('FriendsService: baserow.tables.friendships is 0, the social graph is unavailable.');
      this._hydrated.set(true);
      done?.();
      return;
    }

    const userId = this.userId();
    const email = this.email();
    // Nobody signed in yet (the services construct on the login page) — do not
    // load a shared bucket, just wait for the auth wiring to call us back.
    if (!userId && !email) {
      done?.();
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    // Two queries, because a friendship can name me as either end and Baserow
    // has no OR across different fields in one filter set.
    forkJoin({
      sent: this.baserow.listAllRows<FriendshipRow>(this.tableId, {
        filters: [{ field: 'requester_user_id', op: 'equal', value: userId }]
      }),
      received: this.baserow.listAllRows<FriendshipRow>(this.tableId, {
        filters: [{ field: 'addressee_email', op: 'equal', value: email }]
      })
    })
      .pipe(
        map(({ sent, received }) => {
          const byId = new Map<number, FriendshipRow>();
          // A row can legitimately appear in both when you invite yourself.
          for (const row of [...(sent ?? []), ...(received ?? [])]) byId.set(row.id, row);
          return [...byId.values()].map(toFriendship);
        }),
        catchError(err => {
          console.warn('FriendsService: could not load the social graph.', err);
          this._error.set('Could not load your friends.');
          return of([] as Friendship[]);
        })
      )
      .subscribe(friendships => {
        this._friendships.set(friendships);
        this._loading.set(false);
        this._hydrated.set(true);
        done?.();
      });
  }

  /**
   * Invites by email. The recipient does not need an account yet.
   *
   * Guards against inviting yourself and against duplicates in either
   * direction, since a pending invite each way would be two rows describing
   * one relationship.
   */
  sendRequest(email: string, message?: string): Observable<Friendship | null> {
    const target = normalizeEmail(email);

    if (!isValidEmail(target)) {
      this.toast.warning(
        'Check the address',
        target.includes(' ')
          ? 'Email addresses cannot contain spaces.'
          : 'That does not look like an email address.'
      );
      return of(null);
    }
    if (target === this.email()) {
      this.toast.warning('That is you', 'You cannot add yourself as a friend.');
      return of(null);
    }

    const user = this.auth.currentUserValue;

    // Any row for this pair, in either direction. One pair, one row — always.
    const existing = this._friendships().find(
      f => f.addresseeEmail === target || f.requesterEmail === target
    );

    if (existing?.status === 'accepted') {
      this.toast.info('Already friends', `You and ${target} are already connected.`);
      return of(null);
    }

    if (existing?.status === 'blocked') {
      this.toast.warning('Blocked', 'You cannot invite this person.');
      return of(null);
    }

    /**
     * A declined or withdrawn invite is REVIVED rather than duplicated.
     *
     * Two reasons. One pair should never have two rows — with one declined and
     * one pending, which is the truth? And the client's copy can be stale: if
     * the other person declined while this tab was open, a plain "is there a
     * pending row?" guard silently refuses a perfectly valid re-invite. Reviving
     * is correct whether the local copy is current or not.
     *
     * The requester is rewritten to whoever is inviting now, so B can invite A
     * after A's invite was declined.
     */
    if (existing) {
      const patch = fromFriendship({
        requesterUserId: this.userId(),
        requesterName: user?.name ?? '',
        requesterEmail: this.email(),
        requesterAvatarUrl: user?.profile_picture?.url ?? '',
        addresseeEmail: target,
        // Cleared: the other side has not answered this new invite yet.
        addresseeUserId: '',
        addresseeName: '',
        addresseeAvatarUrl: '',
        status: 'pending',
        inviteMessage: message ?? '',
        requestedAt: new Date()
      });
      // Explicit null: fromFriendship skips undefined, which would leave the
      // old decline timestamp on a freshly re-sent invite.
      patch['responded_at'] = null;

      return this.patch(
        existing.id,
        patch,
        'Invite sent again',
        `${target} will see it next time they open Habiti.`,
        // A re-invite is every bit as new to the recipient as a first one. This
        // was missing, so re-inviting pushed nothing and the other side only
        // found out on its next poll.
        friendship => ({
          kind: 'friend.invited',
          to: [{ email: friendship.addresseeEmail }],
          hint: { scope: ['friends'], refKey: friendship.id }
        })
      );
    }

    const draft: Partial<Friendship> = {
      requesterUserId: this.userId(),
      requesterName: user?.name ?? '',
      requesterEmail: this.email(),
      requesterAvatarUrl: user?.profile_picture?.url ?? '',
      addresseeEmail: target,
      status: 'pending',
      inviteMessage: message ?? '',
      requestedAt: new Date()
    };

    return this.write(fromFriendship(draft), 'Invite sent', `${target} will see it next time they open Habiti.`);
  }

  /** Accepts an incoming invite and stamps my identity onto the row. */
  acceptRequest(friendshipId: string): Observable<Friendship | null> {
    const friendship = this.byId(friendshipId);
    if (!friendship) return of(null);

    const user = this.auth.currentUserValue;
    const patch = fromFriendship({
      status: 'accepted',
      addresseeUserId: this.userId(),
      addresseeName: user?.name ?? '',
      addresseeAvatarUrl: user?.profile_picture?.url ?? '',
      pairKey: pairKeyFor(friendship.requesterUserId, this.userId()),
      respondedAt: new Date()
    });

    return this.patch(
      friendshipId,
      patch,
      'Friend added',
      `You and ${friendship.requesterName || friendship.requesterEmail} are connected.`,
      saved => ({
        kind: 'friend.accepted',
        to: [{ userId: saved.requesterUserId }],
        hint: { scope: ['friends'], refKey: saved.id }
      })
    );
  }

  declineRequest(friendshipId: string): Observable<Friendship | null> {
    return this.patch(
      friendshipId,
      fromFriendship({ status: 'declined', respondedAt: new Date() }),
      'Invite declined',
      undefined,
      saved => ({
        kind: 'friend.declined',
        to: [{ userId: saved.requesterUserId }],
        hint: { scope: ['friends'], refKey: saved.id }
      })
    );
  }

  /** Withdraws an invite I sent. */
  cancelRequest(friendshipId: string): Observable<Friendship | null> {
    return this.patch(
      friendshipId,
      fromFriendship({ status: 'cancelled', respondedAt: new Date() }),
      'Invite withdrawn',
      undefined,
      // Without this the withdrawn invite sits in their Requests tab, still
      // clickable, until their next poll — they can accept something that no
      // longer exists.
      saved => ({
        kind: 'friend.cancelled',
        to: this.peerAddresses(saved),
        hint: { scope: ['friends'], refKey: saved.id }
      })
    );
  }

  /**
   * Ends a friendship. Deletes the row rather than marking it — there is no
   * history worth keeping, and leaving it as 'declined' would block a future
   * invite between the same two people.
   */
  removeFriend(friendshipId: string): Observable<void> {
    if (!this.tableId) return of(undefined);

    // Captured before the delete: afterwards there is no row to address from.
    const friendship = this.byId(friendshipId);

    return this.baserow.deleteRow(this.tableId, Number(friendshipId)).pipe(
      map(() => {
        this._friendships.update(list => list.filter(f => f.id !== friendshipId));
        this.toast.info('Friend removed');
        this.bus.touched('friends');
        if (friendship) {
          this.bus.emit({
            kind: 'friend.removed',
            to: this.peerAddresses(friendship),
            hint: { scope: ['friends'], refKey: friendship.id }
          });
        }
        return undefined;
      }),
      catchError(err => {
        console.warn('FriendsService: could not remove the friendship.', err);
        this.toast.error('Could not remove', 'Please try again.');
        return of(undefined);
      })
    );
  }

  /** Blocks — kept as a row on purpose, so the same person cannot re-invite. */
  blockUser(friendshipId: string): Observable<Friendship | null> {
    return this.patch(
      friendshipId,
      fromFriendship({ status: 'blocked', respondedAt: new Date() }),
      'Blocked'
    );
  }

  friendByUserId(userId: string): Friend | undefined {
    return this.friends().find(f => f.userId === String(userId));
  }

  private byId(id: string): Friendship | undefined {
    return this._friendships().find(f => f.id === id);
  }

  /**
   * How to reach the OTHER party of a friendship.
   *
   * Both a user id and an email when we have them: an invitee has no user id
   * until they answer, so email is the only way to reach them — while an
   * accepted friend is reachable by id even if they changed their address.
   */
  private peerAddresses(friendship: Friendship): { userId: string }[] | { email: string }[] {
    const iAmRequester = friendship.requesterUserId === this.userId();
    const peerId = iAmRequester ? friendship.addresseeUserId : friendship.requesterUserId;
    const peerEmail = iAmRequester ? friendship.addresseeEmail : friendship.requesterEmail;

    const addresses: ({ userId: string } | { email: string })[] = [];
    if (peerId) addresses.push({ userId: peerId });
    if (peerEmail) addresses.push({ email: peerEmail });
    return addresses as { userId: string }[];
  }

  private write(
    data: Record<string, unknown>,
    title: string,
    message?: string
  ): Observable<Friendship | null> {
    if (!this.tableId) return of(null);

    return this.baserow.createRow<FriendshipRow>(this.tableId, data).pipe(
      map(row => {
        if (!row) return null;
        const friendship = toFriendship(row);
        this._friendships.update(list => [...list, friendship]);
        this.toast.success(title, message);
        // Go hot: the other side is expected to answer shortly.
        this.bus.touched('friends');
        // Addressed by EMAIL: at invite time we do not know their user id,
        // because there is no user-search endpoint.
        this.bus.emit({
          kind: 'friend.invited',
          to: [{ email: friendship.addresseeEmail }],
          hint: { scope: ['friends'], refKey: friendship.id }
        });
        return friendship;
      }),
      catchError(err => {
        console.warn('FriendsService: could not send the invite.', err);
        this.toast.error('Could not send', 'Please try again.');
        return of(null);
      })
    );
  }

  /**
   * `event` fires only AFTER the row is written.
   *
   * The accept/decline paths used to emit before the PATCH resolved, so a
   * failed write still told the peer to refetch — they would reload and see
   * the unchanged row. Harmless (hints carry no data) but wrong, and it made
   * the ordering hard to reason about. Success first, then the nudge.
   */
  private patch(
    id: string,
    data: Record<string, unknown>,
    title: string,
    message?: string,
    event?: (friendship: Friendship) => OutboundEvent | null
  ): Observable<Friendship | null> {
    if (!this.tableId) return of(null);

    return this.baserow.updateRow<FriendshipRow>(this.tableId, Number(id), data).pipe(
      map(row => {
        if (!row) return null;
        const friendship = toFriendship(row);
        this._friendships.update(list => list.map(f => (f.id === id ? friendship : f)));
        this.toast.success(title, message);
        this.bus.touched('friends');
        const outbound = event?.(friendship);
        if (outbound) this.bus.emit(outbound);
        return friendship;
      }),
      catchError(err => {
        console.warn('FriendsService: could not update the friendship.', err);
        this.toast.error('Could not update', 'Please try again.');
        return of(null);
      })
    );
  }

  private userId(): string {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : '';
  }

  private email(): string {
    return normalizeEmail(this.auth.currentUserValue?.email);
  }
}
