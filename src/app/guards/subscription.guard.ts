import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const SubscriptionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Get required subscription tier from route data
  const requiredTier = route.data?.['subscriptionTier'] as string | undefined;

  if (!requiredTier) {
    return true; // No subscription requirement
  }

  // In production, check user's subscription status
  // For now, allow access
  const user = authService.currentUserValue;
  if (user) {
    // TODO: Implement actual subscription check
    // const hasValidSubscription = checkSubscription(user, requiredTier);
    return true;
  }

  // Redirect to subscription page
  router.navigate(['/settings/subscription'], {
    queryParams: { required: requiredTier, returnUrl: state.url }
  });
  return false;
};
