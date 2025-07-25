// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    take(1),
    map(user => {
      // Check if user is authenticated
      if (user) {
        // Check for role requirements
        if (route.data?.['roles'] && !route.data['roles'].includes(user.role)) {
          return router.createUrlTree(['/unauthorized']);
        }
        return true;
      }
      
      // Redirect to login with return URL
      return router.createUrlTree(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
    })
  );
};

export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    take(1),
    map(user => {
      if (!user) {
        return true;
      }
      return router.createUrlTree(['/home']);
    })
  );
};