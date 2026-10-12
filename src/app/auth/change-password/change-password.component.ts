// src/app/auth/change-password/change-password.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent {
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  hideCurrentPassword: boolean = true;
  hideNewPassword: boolean = true;
  hideConfirmPassword: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  isSuccess: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New passwords do not match';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.authService.changePassword(this.currentPassword, this.newPassword);
      this.isSuccess = true;
      this.successMessage = 'Password changed successfully! Redirecting to dashboard...';
      setTimeout(() => this.goToDashboard(), 2000);
    } catch (error: any) {
      this.errorMessage = error?.message || 'Failed to change password. Please check your current password and try again.';
      console.error('Password change error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/home']);
  }
}
