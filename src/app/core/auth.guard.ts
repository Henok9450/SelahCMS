// // src/app/core/guards/auth.guard.ts
// import { inject } from '@angular/core';
// import { CanActivateFn, Router, UrlTree } from '@angular/router';
// //import { AuthService } from './auth.service';
// import { map, take } from 'rxjs/operators';

// export const authGuard: CanActivateFn = () => {
//   const authService = inject(AuthService);
//   const router = inject(Router);

//   return authService.authState.pipe(
//     take(1),
//     map(user => {
//       if (user) {
//         return true;
//       }
//       return router.createUrlTree(['/login']);
//     })
//   );
// };

// export const noAuthGuard: CanActivateFn = () => {
//   const authService = inject(AuthService);
//   const router = inject(Router);

//   return authService.authState.pipe(
//     take(1),
//     map(user => {
//       if (!user) {
//         return true;
//       }
//       return router.createUrlTree(['/dashboard']);
//     })
//   );
// };