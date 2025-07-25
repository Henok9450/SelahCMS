import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../core/auth.service'; 

@Injectable({
  providedIn: 'root'
})
export class PastorDeputyPastorGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return combineLatest([this.authService.isPastor$, this.authService.isDeputyPastor$]).pipe(
      take(1),
      map(([isPastor, isDeputyPastor]) => {
        if (isPastor || isDeputyPastor) {
          return true;
        } else {
          return this.router.createUrlTree(['/unauthorized']);
        }
      })
    );
  }
}