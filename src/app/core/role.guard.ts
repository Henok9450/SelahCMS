// import { Injectable } from '@angular/core';
// import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
// import { AuthService } from './auth.service';
// import { UserService } from '../core/user.service';
// import { map, switchMap, take } from 'rxjs/operators';
// import { Observable, of } from 'rxjs';
// import { User } from '../core/user.model';

// @Injectable({
//   providedIn: 'root'
// })
// export class RoleGuard implements CanActivate {
//   constructor(
//     private authService: AuthService,
//     private userService: UserService,
//     private router: Router
//   ) {}

//   canActivate(
//     next: ActivatedRouteSnapshot,
//     state: RouterStateSnapshot
//   ): Observable<boolean> {
//     const allowedRoles = next.data['roles'] as string[];
    
//     return this.authService.authState.pipe(
//       take(1),
//       switchMap(user => {
//         if (!user) {
//           this.router.navigate(['/login']);
//           return of(false);
//         }
//         return this.userService.getUser(user.uid).pipe(
//           map(userDoc => this.checkUserRole(userDoc, allowedRoles))
//         );
//       })
//     );
//   }

//   private checkUserRole(userDoc: User | undefined, allowedRoles: string[]): boolean {
//     if (userDoc && allowedRoles.includes(userDoc.role)) {
//       return true;
//     }
//     this.router.navigate(['/unauthorized']);
//     return false;
//   }
// }