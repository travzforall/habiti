import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import { PlanTier } from '../models/daily-content.models';

/**
 * The user's Habiti plan.
 *
 * This is the single place that answers "is this user paying?". Features must
 * read `isPaid()` rather than poking at `user.subscription_tier`, so that when
 * the real billing check lands (SubscriptionGuard is still a TODO stub) there
 * is one thing to change.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private auth = inject(AuthService);

  private readonly user = toSignal(this.auth.currentUser, { initialValue: null });

  /** Anything other than an explicit 'plus' is free — absence is never a paid plan. */
  readonly tier = computed<PlanTier>(() =>
    this.user()?.subscription_tier === 'plus' ? 'plus' : 'free'
  );

  readonly isPaid = computed(() => this.tier() === 'plus');
  readonly isFree = computed(() => !this.isPaid());

  /** Free members see ads. Kept as its own signal so it can be relaxed later. */
  readonly showsAds = computed(() => this.isFree());

  /** True when the plan is at least `required`. */
  allows(required: PlanTier): boolean {
    return required === 'free' || this.isPaid();
  }
}
