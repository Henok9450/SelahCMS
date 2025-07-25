import { Component, OnDestroy  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterModule
  ]
})
export class ForgotPasswordComponent implements OnDestroy {
  email: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
   private authSub: Subscription | null = null;


  constructor(
    private auth: Auth,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

async resetPassword() {
    if (!this.email) return;

    this.isLoading = true;
    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.snackBar.open('Reset link sent to your email', 'Close', { duration: 5000 });
      this.router.navigate(['/login']);
    } catch (error) {
      this.snackBar.open('Error sending reset email', 'Close');
      console.error('Password reset error:', error);
    } finally {
      this.isLoading = false;
    }
  }
   ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }
  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}