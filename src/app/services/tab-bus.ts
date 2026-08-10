import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { RefreshScope, RelayEnvelope } from '../models/realtime.models';

export type TabMessage =
  | { type: 'refresh'; scopes: RefreshScope[]; nonce: string }
  | { type: 'realtime'; envelope: RelayEnvelope }
  | { type: 'auth'; userId: string | null };

const CHANNEL = 'habiti-sync';
/** Bounded so the dedupe set cannot grow without limit in a long session. */
const MAX_SEEN = 200;

/**
 * Talks to this browser's other Habiti tabs.
 *
 * Two jobs: a sync in one tab updates the rest immediately, and only ONE tab
 * needs a realtime socket for all of them to react to a pushed event.
 *
 * Feature-detected — no-ops where BroadcastChannel is unavailable, which
 * includes some test environments.
 */
@Injectable({ providedIn: 'root' })
export class TabBus implements OnDestroy {
  private readonly _messages = new Subject<TabMessage>();
  readonly messages$: Observable<TabMessage> = this._messages.asObservable();

  private channel: BroadcastChannel | null = null;
  private readonly seen: string[] = [];
  private readonly seenSet = new Set<string>();

  constructor() {
    if (typeof BroadcastChannel === 'undefined') return;

    try {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = event => {
        const message = event.data as TabMessage;
        if (!message?.type) return;
        // Dedupe on the server-generated nonce: an envelope can arrive both
        // directly (our own socket) and via a sibling tab.
        if (this.isDuplicate(message)) return;
        this._messages.next(message);
      };
    } catch {
      this.channel = null;
    }
  }

  post(message: TabMessage): void {
    if (!this.channel) return;
    this.remember(message);
    try {
      this.channel.postMessage(message);
    } catch {
      // A structured-clone failure must not break the caller's flow.
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  private keyOf(message: TabMessage): string | null {
    if (message.type === 'refresh') return `r:${message.nonce}`;
    if (message.type === 'realtime') return `e:${message.envelope.nonce}`;
    return null;
  }

  private isDuplicate(message: TabMessage): boolean {
    const key = this.keyOf(message);
    if (!key) return false;
    if (this.seenSet.has(key)) return true;
    this.push(key);
    return false;
  }

  private remember(message: TabMessage): void {
    const key = this.keyOf(message);
    if (key) this.push(key);
  }

  private push(key: string): void {
    this.seenSet.add(key);
    this.seen.push(key);
    while (this.seen.length > MAX_SEEN) {
      const oldest = this.seen.shift();
      if (oldest) this.seenSet.delete(oldest);
    }
  }
}
