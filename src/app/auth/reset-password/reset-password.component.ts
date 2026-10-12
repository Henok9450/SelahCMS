import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Auth, confirmPasswordReset, verifyPasswordResetCode } from '@angular/fire/auth';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  oobCode: string = '';
  userEmail: string = '';
  newPassword: string = '';
  confirmPassword: string = '';

  hideNewPassword: boolean = true;
  hideConfirmPassword: boolean = true;

  isVerifyingCode: boolean = true;
  isCodeValid: boolean = false;
  isSubmitting: boolean = false;
  isSuccess: boolean = false;

  errorMessage: string = '';
  countdownSeconds: number = 3;
  private redirectTimer: any;

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParams['oobCode'];
    if (!code) {
      this.isVerifyingCode = false;
      this.isCodeValid = false;
      this.errorMessage = 'No password setup code found in link. Please request a new setup email.';
      return;
    }

    this.oobCode = code;
    try {
      this.userEmail = await verifyPasswordResetCode(this.auth, this.oobCode);
      this.isCodeValid = true;
    } catch (error: any) {
      console.error('Error verifying reset code:', error);
      this.isCodeValid = false;
      this.errorMessage = 'This setup or reset link is expired or has already been used. Please request a new link.';
    } finally {
      this.isVerifyingCode = false;
    }
  }

  async setPassword(): Promise<void> {
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Please fill in both password fields.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      await confirmPasswordReset(this.auth, this.oobCode, this.newPassword);
      this.isSuccess = true;

      // Start countdown redirect to dashboard/login
      this.redirectTimer = setInterval(() => {
        this.countdownSeconds--;
        if (this.countdownSeconds <= 0) {
          this.goToDashboard();
        }
      }, 1000);
    } catch (error: any) {
      console.error('Password reset confirmation failed:', error);
      this.errorMessage = error?.message || 'Failed to set password. The link may have expired.';
    } finally {
      this.isSubmitting = false;
    }
  }

  goToDashboard(): void {
    if (this.redirectTimer) {
      clearInterval(this.redirectTimer);
    }
    this.router.navigate(['/login']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearInterval(this.redirectTimer);
    }
  }
}
