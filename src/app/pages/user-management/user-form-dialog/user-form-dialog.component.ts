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
import { of } from 'rxjs';

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
    MatProgressSpinnerModule
  ]
})
export class UserFormDialogComponent implements OnInit {
  userForm!: FormGroup;
  isEditMode = false;
  loading = false;
  passwordVisible = false;
  loadingHiyawMahiders = true;

  hiyawMahiders$!: Observable<any[]>;
  roles = ['Admin', 'Pastor', 'Deputy', 'Member'];
  maritalStatuses = ['Married', 'Single'];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    public dialogRef: MatDialogRef<UserFormDialogComponent>,
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
      phoneNumber: ['', [
        Validators.required,
        Validators.pattern(/^09\d{8}$/)
      ]],
      residencyLocation: ['', Validators.required],
      maritalStatus: ['', Validators.required],
      assignedHiyawMahider: ['', Validators.required],
      pastor: [{value: '', disabled: true}],
      deputyPastor: [{value: '', disabled: true}],
      role: ['Member', Validators.required],
      password: ['', [
        Validators.required, 
        Validators.minLength(6),
        ...(!this.isEditMode ? [] : [Validators.nullValidator])
      ]],
      active: [true]
    });

    // Watch for Hiyaw Mahider selection changes
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
      }
    });
  }

  async patchForm(user: User): Promise<void> {
    this.userForm.patchValue({
      ...user,
      password: null // Don't show existing password
    });
  
    // Load pastors if Hiyaw Mahider is already assigned
    if (user.assignedHiyawMahider) {
      try {
        const pastors = await this.userService.getPastorsForHiyawMahider(user.assignedHiyawMahider).toPromise();
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
      }
    }

    const passwordControl = this.userForm.get('password');
    if (passwordControl) {
      passwordControl.clearValidators();
      passwordControl.updateValueAndValidity();
    }
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
    if (this.userForm.invalid) return;
  
    this.loading = true;
    try {
      const formValue = this.userForm.getRawValue();
  
      if (this.isEditMode) {
        if (!this.data.user.id) {
          console.error('User ID is missing. Cannot update user.');
          return;
        }
  
        // Update existing user
        await this.userService.updateUser(this.data.user.id, {
          ...formValue,
          updatedAt: new Date()
        });
      } else {
        // Create new user
        await this.userService.createUser({
          ...formValue,
          assignedHiyawMahider: formValue.assignedHiyawMahider,
          pastor: formValue.pastor,
          deputyPastor: formValue.deputyPastor
        });
      }
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.loading = false;
    }
  }
}