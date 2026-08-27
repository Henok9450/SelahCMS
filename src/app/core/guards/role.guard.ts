import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { AppRole } from '../utils/role.utils';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const requiredRoles = route.data['roles'] as AppRole[];
    
    return this.auth.authState$.pipe(
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }
        
        if (!requiredRoles || requiredRoles.includes(user.role)) {
          return true;
        }
        
        this.router.navigate(['/unauthorized']);
        return false;
      })
    );
  }
}
