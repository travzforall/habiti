import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FriendsService } from '../../services/friends.service';
import { StatusAvatarComponent } from '../../components/status-avatar/status-avatar.component';
import { Friend } from '../../models/friend.models';

type FriendsTab = 'friends' | 'incoming' | 'sent';

/**
 * Friends: who you are connected to, who is waiting on you, and who you are
 * waiting on.
 *
 * Invites go out by email — there is no user search — so you can invite
 * someone who has not signed up yet and the invite waits for them.
 */
@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatusAvatarComponent],
  templateUrl: './friends.html',
  styleUrl: './friends.scss'
})
export class FriendsComponent {
  private friendsService = inject(FriendsService);

  protected readonly friends = this.friendsService.friends;
  protected readonly incoming = this.friendsService.incomingRequests;
  protected readonly outgoing = this.friendsService.outgoingRequests;
  /** The tab badge counts only what is still genuinely waiting. */
  protected readonly pendingOutgoing = this.friendsService.pendingOutgoing;
  protected readonly loading = this.friendsService.loading;
  protected readonly error = this.friendsService.error;

  protected readonly tab = signal<FriendsTab>('friends');
  protected readonly inviteEmail = signal('');
  protected readonly inviteMessage = signal('');
  protected readonly sending = signal(false);

  protected readonly tabs = computed(() => [
    { id: 'friends' as const, label: 'Friends', count: this.friends().length },
    { id: 'incoming' as const, label: 'Requests', count: this.incoming().length },
    { id: 'sent' as const, label: 'Sent', count: this.pendingOutgoing().length }
  ]);

  protected readonly visible = computed<Friend[]>(() => {
    switch (this.tab()) {
      case 'incoming':
        return this.incoming();
      case 'sent':
        return this.outgoing();
      default:
        return this.friends();
    }
  });

  protected select(tab: FriendsTab): void {
    this.tab.set(tab);
  }

  protected invite(): void {
    const email = this.inviteEmail().trim();
    if (!email || this.sending()) return;

    this.sending.set(true);
    this.friendsService.sendRequest(email, this.inviteMessage().trim()).subscribe(result => {
      this.sending.set(false);
      if (result) {
        this.inviteEmail.set('');
        this.inviteMessage.set('');
        this.tab.set('sent');
      }
    });
  }

  protected accept(friend: Friend): void {
    this.friendsService.acceptRequest(friend.friendshipId).subscribe();
  }

  protected decline(friend: Friend): void {
    this.friendsService.declineRequest(friend.friendshipId).subscribe();
  }

  protected cancel(friend: Friend): void {
    this.friendsService.cancelRequest(friend.friendshipId).subscribe();
  }

  protected remove(friend: Friend): void {
    this.friendsService.removeFriend(friend.friendshipId).subscribe();
  }

  protected refresh(): void {
    this.friendsService.load();
  }

  /** Someone who has not accepted yet has no name — show the email instead. */
  protected displayName(friend: Friend): string {
    return friend.name || friend.email;
  }
}
