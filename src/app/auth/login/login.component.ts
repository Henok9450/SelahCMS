import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    RouterModule
  ]
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  hidePassword: boolean = true;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }
  

// login.component.ts
async login(): Promise<void> {
  if (!this.email || !this.password) {
    this.errorMessage = 'Please enter both email and password';
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  try {
    // Store admin password securely before attempting login
    if (this.isAdminEmail(this.email)) { // Implement isAdminEmail check
      await this.authService.storeAdminPassword(this.password);
    }

    const response = await this.authService.login(this.email, this.password);
    
    // Clear stored password after successful login
    if (this.isAdminEmail(this.email)) {
      await this.authService.clearStoredAdminPassword();
    }

    // Handle redirect after login
    const returnUrl = this.router.parseUrl(this.router.url).queryParams['returnUrl'] || '/home';
    this.router.navigateByUrl(returnUrl);
    
  } catch (error: any) {
    // Clear stored password on error too
    await this.authService.clearStoredAdminPassword();
    this.errorMessage = error.message || 'Login failed. Please try again.';
  } finally {
    this.isLoading = false;
  }
}

private isAdminEmail(email: string): boolean {
  // Implement your logic to check if email belongs to admin
  return email.endsWith('@admin-domain.com'); // Example
}
}
