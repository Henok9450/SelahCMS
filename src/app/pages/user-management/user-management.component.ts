import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, of } from 'rxjs';
import { User } from '../../core/user.model';
import { UserService } from '../../core/user.service';
import { UserFormDialogComponent } from '../user-management/user-form-dialog/user-form-dialog.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { map, tap, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { HiyawMahider } from '../../core/hiyaw-mahider.model';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class UserManagementComponent implements OnInit {
  users$!: Observable<User[]>;
  displayedColumns: string[] = [
    'userName',
    'fullName',
    'contact',
    'hiyawMahider',
    'status',
    'actions'
  ];

  // Search and pagination properties
  searchParams = {
    username: '',
    hiyawMahider: '',
    status: '',
    pastor: '',
    deputy: ''
  };
  
  pastorSearchControl = new FormControl();
  deputySearchControl = new FormControl();
  
  pageSize = 10;
  currentPage = 0;
  totalUsers = 0;
  hiyawMahiders: HiyawMahider[] = [];
  loading = true;

  constructor(
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadHiyawMahiders();
    this.loadUsers();

    // Setup debounced search for pastor
    this.pastorSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(value => {
          this.searchParams.pastor = value;
          this.applyFilters();
        })
      )
      .subscribe();

    // Setup debounced search for deputy
    this.deputySearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(value => {
          this.searchParams.deputy = value;
          this.applyFilters();
        })
      )
      .subscribe();
  }

  loadHiyawMahiders(): void {
    this.hiyawMahiderService.getActiveHiyawMahiders().subscribe({
      next: (hiyawMahiders) => {
        this.hiyawMahiders = hiyawMahiders;
      },
      error: (error) => {
        console.error('Error loading Hiyaw Mahiders:', error);
        this.snackBar.open('Failed to load Hiyaw Mahiders', 'Close', { duration: 3000 });
      }
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.users$ = this.userService.getUsersWithDetails().pipe(
      map(users => {
        // Apply filters
        let filteredUsers = users.filter(user => {
          // Username filter (partial match)
          if (this.searchParams.username && 
              !user.userName.toLowerCase().includes(this.searchParams.username.toLowerCase())) {
            return false;
          }
          
          // Hiyaw Mahider filter
          if (this.searchParams.hiyawMahider && 
              user.assignedHiyawMahider !== this.searchParams.hiyawMahider) {
            return false;
          }
          
          // Status filter
          if (this.searchParams.status === 'active' && !user.active) {
            return false;
          }
          if (this.searchParams.status === 'inactive' && user.active) {
            return false;
          }
          
          // Pastor filter (partial match)
          if (this.searchParams.pastor && 
              (!user.pastor || !user.pastor.toLowerCase().includes(this.searchParams.pastor.toLowerCase()))) {
            return false;
          }
          
          // Deputy filter (partial match)
          if (this.searchParams.deputy && 
              (!user.deputyPastor || !user.deputyPastor.toLowerCase().includes(this.searchParams.deputy.toLowerCase()))) {
            return false;
          }
          
          return true;
        });

        // Update total count
        this.totalUsers = filteredUsers.length;
        
        // Apply pagination
        const startIndex = this.currentPage * this.pageSize;
        return filteredUsers
          .slice(startIndex, startIndex + this.pageSize)
          .map(user => ({
            ...user,
            pastorName: user.pastor || 'Not assigned',
            deputyPastorName: user.deputyPastor || 'Not assigned',
            hiyawMahiderName: user.assignedHiyawMahider 
              ? this.getHiyawMahiderName(user.assignedHiyawMahider) 
              : 'None'
          }));
      }),
      tap(() => this.loading = false)
    );
  }

  getHiyawMahiderName(hiyawMahiderId: string): string {
    const hm = this.hiyawMahiders.find(h => h.id === hiyawMahiderId);
    return hm ? `${hm.name} (${hm.code})` : 'Unknown';
  }

  applyFilters(): void {
    this.currentPage = 0; // Reset to first page when filters change
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  


  openUserDialog(user?: User): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '600px',
      data: user ? { user } : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadUsers();
    });
  }

  resetPassword(user: User): void {
    if (!user.id) {
      this.snackBar.open('User ID is missing. Cannot reset password.', 'Close', { duration: 3000 });
      return;
    }
  
    this.userService.updateUser(user.id, {
      password: this.generateTempPassword(),
      firstLogin: true,
      updatedAt: new Date()
    }).then(() => {
      this.snackBar.open('Password reset successfully. New temporary password generated.', 'Close', { duration: 3000 });
    }).catch(error => {
      this.snackBar.open('Failed to reset password. Please try again.', 'Close', { duration: 3000 });
      console.error('Error resetting password:', error);
    });
  }

  toggleUserStatus(user: User): void {
    if (!user.id) {
      this.snackBar.open('User ID is missing. Cannot toggle status.', 'Close', { duration: 3000 });
      return;
    }
  
    const newStatus = !user.active;
    const statusText = newStatus ? 'activated' : 'deactivated';
    const action = newStatus ? 'activate' : 'deactivate';
  
    // Confirm before deactivating
    if (!newStatus) {
      const confirm = window.confirm(`Are you sure you want to deactivate ${user.fullName}?`);
      if (!confirm) return;
    }
  
    this.userService.updateUser(user.id, {
      active: newStatus,
      updatedAt: new Date()
    }).then(() => {
      this.snackBar.open(`User ${statusText} successfully`, 'Close', { duration: 3000 });
      this.loadUsers();
    }).catch(error => {
      this.snackBar.open(`Failed to ${action} user. Please try again.`, 'Close', { duration: 3000 });
      console.error(`Error ${action} user:`, error);
    });
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}