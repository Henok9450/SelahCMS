// src/app/user-management/user-form-dialog/user-form-dialog.component.ts
import { Component, Inject, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from '../../../core/user.service';
import { HiyawMahiderService } from '../../../core/hiyaw-mahider.service';
import { User } from '../../../core/user.model';
import { Observable } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import { catchError } from 'rxjs/operators';
import { of, firstValueFrom } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
  styleUrls: ['./user-form-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ]
})
export class UserFormDialogComponent implements OnInit {
  userForm!: FormGroup;
  isEditMode = false;
  loading = false;
  // REMOVED: passwordVisible and adminPasswordVisible
  loadingHiyawMahiders = true;

  hiyawMahiders$!: Observable<any[]>;
  roles = ['Admin', 'Pastor', 'Deputy', 'Member'];
  maritalStatuses = ['Married', 'Single'];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    public dialogRef: MatDialogRef<UserFormDialogComponent>,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: { user: User }
  ) {
    this.isEditMode = !!data?.user;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadHiyawMahiders();

    if (this.isEditMode) {
      this.patchForm(this.data.user);
    }
  }

  initForm(): void {
    this.userForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [
        Validators.required,
        Validators.pattern(/^0[79]\d{8}$/)
      ]],
      residencyLocation: ['', Validators.required],
      maritalStatus: ['', Validators.required],
      assignedHiyawMahider: ['', Validators.required],
      pastor: [{ value: '', disabled: true }],
      deputyPastor: [{ value: '', disabled: true }],
      role: ['Member', Validators.required],
      // REMOVED password and adminPassword fields from form group initialization
      active: [true] // Always active by default for new users, modifiable in edit mode
    });

    this.userForm.get('assignedHiyawMahider')!.valueChanges.pipe(
      filter((hiyawMahiderId): hiyawMahiderId is string => !!hiyawMahiderId),
      switchMap((hiyawMahiderId: string) =>
        this.userService.getPastorsForHiyawMahider(hiyawMahiderId)
      )
    ).subscribe({
      next: (pastors) => {
        this.userForm.patchValue({
          pastor: pastors?.pastor || 'Not assigned',
          deputyPastor: pastors?.deputyPastor || 'Not assigned'
        }, { emitEvent: false });
      },
      error: (err) => {
        console.error('Error loading pastors:', err);
        this.userForm.patchValue({
          pastor: 'Error loading',
          deputyPastor: 'Error loading'
        });
        this.snackBar.open('Failed to load pastor/deputy information.', 'Close', { duration: 3000 });
      }
    });
  }

  async patchForm(user: User): Promise<void> {
    this.userForm.patchValue({
      ...user,
      // No password field to patch
    });

    if (user.assignedHiyawMahider) {
      try {
        const pastors = await firstValueFrom(this.userService.getPastorsForHiyawMahider(user.assignedHiyawMahider));
        this.userForm.patchValue({
          pastor: pastors?.pastor || 'Not assigned',
          deputyPastor: pastors?.deputyPastor || 'Not assigned'
        });
      } catch (error) {
        console.error('Error loading pastors:', error);
        this.userForm.patchValue({
          pastor: 'Error loading',
          deputyPastor: 'Error loading'
        });
        this.snackBar.open('Failed to load pastor/deputy information for selected Hiyaw Mahider.', 'Close', { duration: 3000 });
      }
    }
    // No password control to clear validators or update validity
  }

  loadHiyawMahiders(): void {
    this.loadingHiyawMahiders = true;
    this.hiyawMahiders$ = this.hiyawMahiderService.getActiveHiyawMahiders().pipe(
      tap({
        next: (hiyawMahiders) => {
          console.log('Loaded Hiyaw Mahiders:', hiyawMahiders);
          this.loadingHiyawMahiders = false;
        },
        error: (err) => {
          console.error('Error loading Hiyaw Mahiders:', err);
          this.loadingHiyawMahiders = false;
          this.snackBar.open('Failed to load Hiyaw Mahiders.', 'Close', { duration: 3000 });
        }
      }),
      catchError(error => {
        console.error('Error loading Hiyaw Mahiders:', error);
        this.loadingHiyawMahiders = false;
        return of([]);
      })
    );
  }

  async onSubmit(): Promise<void> {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields and correct any errors.', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    try {
      const formValue = this.userForm.getRawValue(); // getRawValue includes disabled controls

      if (this.isEditMode) {
        if (!this.data.user.uid) {
          console.error('User ID is missing. Cannot update user.');
          this.snackBar.open('Error: User ID is missing for update.', 'Close', { duration: 3000 });
          return;
        }

        await this.userService.updateUser(this.data.user.uid, {
          fullName: formValue.fullName,
          email: formValue.email,
          phoneNumber: formValue.phoneNumber,
          residencyLocation: formValue.residencyLocation,
          maritalStatus: formValue.maritalStatus,
          role: formValue.role,
          active: formValue.active,
          assignedHiyawMahider: formValue.assignedHiyawMahider,
          pastor: formValue.pastor,
          deputyPastor: formValue.deputyPastor,
        });
        this.snackBar.open('User updated successfully!', 'Close', { duration: 3000 });
      } else {
        // For new user creation, call authService.register without password
        await this.authService.register({
          email: formValue.email,
          fullName: formValue.fullName,
          phoneNumber: formValue.phoneNumber,
          residencyLocation: formValue.residencyLocation,
          maritalStatus: formValue.maritalStatus,
          role: formValue.role,
          active: formValue.active,
          assignedHiyawMahider: formValue.assignedHiyawMahider,
          pastor: formValue.pastor,
          deputyPastor: formValue.deputyPastor
        });
        // Updated success message
        this.snackBar.open('User created successfully! A login link has been sent to their email.', 'Close', { duration: 5000 });
      }
      this.dialogRef.close(true);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      const errorMessage = error.message || 'Failed to save user. Please check console for details.';
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }
}