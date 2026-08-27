import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon'; // Add this import
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; // Import AuthService
import { inject } from '@angular/core'; // Import inject

@Component({
  selector: 'app-unauthorized',
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule, // Add this to imports array
    RouterModule
  ]
})
export class UnauthorizedComponent {
  authService = inject(AuthService); // Add AuthService injection
}
