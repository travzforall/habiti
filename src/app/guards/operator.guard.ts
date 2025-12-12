import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const OperatorGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Check if user has operator role
  const user = authService.currentUserValue;
  if (user && (user.role === 'operator' || user.role === 'admin' || user.role === 'supervisor')) {
    return true;
  }

  // Redirect non-operators to dashboard
  router.navigate(['/dashboard']);
  return false;
};
