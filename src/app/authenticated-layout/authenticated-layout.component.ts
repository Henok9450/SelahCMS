import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

import { AuthService } from '../core/auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    
    MatProgressSpinnerModule
  ],
  templateUrl: './authenticated-layout.component.html',
  styleUrls: ['./authenticated-layout.component.css']
})
export class AuthenticatedLayoutComponent {
  authService = inject(AuthService);
  
  // Optional: Loading state for initial auth check
  isLoading = true;

  constructor() {
    // Optional: Verify authentication status
    this.authService.authState$.pipe(
      first() // Just check once on component initialization
    ).subscribe(() => {
      this.isLoading = false;
    });
  }
}