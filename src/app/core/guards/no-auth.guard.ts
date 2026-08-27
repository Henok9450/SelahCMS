import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    try {
      // Get the current auth state once
      const currentUser = await firstValueFrom(this.authService.authState$);
      
      if (currentUser) {
        console.log('NoAuthGuard: User is already authenticated, redirecting to home');
        this.router.navigate(['/home']);
        return false;
      }
      
      console.log('NoAuthGuard: No authenticated user found, allowing access');
      return true;
    } catch (error) {
      console.error('NoAuthGuard: Error checking auth state:', error);
      // If there's an error checking auth state, allow access to login page
      return true;
    }
  }
}
