// members-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator'; // Add this import
import { Observable, of, Subject, Subscription } from 'rxjs';
import { switchMap, tap, catchError, takeUntil } from 'rxjs/operators';
import { User } from '../../core/user.model';
import { AuthService } from '../../core/auth.service';
import { MembersService } from '../../core/members.service';

@Component({
  selector: 'app-members-list',
  templateUrl: './members-list.component.html',
  styleUrls: ['./members-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatPaginatorModule, // Add this to imports
  ],
})
export class MembersListComponent implements OnInit, OnDestroy {
  members$: Observable<User[]> = of([]);
  isLoading: boolean = true;
  errorMessage: string | null = null;
  
  // Pagination variables
  paginatedMembers: User[] = [];
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25, 50];
  totalMembers = 0;

  private destroy$ = new Subject<void>();
  private authSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private membersService: MembersService
  ) {
    console.log('MembersListComponent constructor');
  }

  ngOnInit(): void {
    console.log('MembersListComponent ngOnInit: Setting up auth state subscription.');

    this.authSubscription = this.authService.authState$.pipe(
      tap(currentUser => {
        console.log('MembersListComponent: AuthState emitted (inside tap):', currentUser);
        this.isLoading = true;
        this.errorMessage = null;
      }),
      switchMap(currentUser => {
        if (!currentUser) {
          console.log('MembersListComponent: switchMap: No current user, returning empty array.');
          this.errorMessage = 'User not authenticated. Please log in.';
          this.isLoading = false;
          return of([]);
        }

        console.log(`MembersListComponent: switchMap: User is role '${currentUser.role}', Assigned Hiyaw Mahider: ${currentUser.assignedHiyawMahider}.`);

        if (currentUser.role === 'Admin') {
          console.log('MembersListComponent: switchMap: Calling MembersService.getAllActiveMembers().');
          return this.membersService.getAllActiveMembers().pipe(
            tap(members => {
              console.log('MembersListComponent: Data received (Admin):', members);
              this.isLoading = false;
              this.totalMembers = members.length;
              this.updatePaginatedMembers(members);
            }),
            catchError(error => {
              console.error('MembersListComponent: Error fetching all members for Admin:', error);
              this.errorMessage = 'Failed to load all members. Please try again.';
              this.isLoading = false;
              return of([]);
            })
          );
        } else if (currentUser.assignedHiyawMahider) {
          console.log(`MembersListComponent: switchMap: Calling MembersService.getMembersInAssignedHiyawMahider(${currentUser.assignedHiyawMahider}).`);
          return this.membersService.getMembersInAssignedHiyawMahider(currentUser.assignedHiyawMahider).pipe(
            tap(members => {
              console.log(`MembersListComponent: Data received (Hiyaw Mahider ${currentUser.assignedHiyawMahider}):`, members);
              this.isLoading = false;
              this.totalMembers = members.length;
              this.updatePaginatedMembers(members);
            }),
            catchError(error => {
              console.error(`MembersListComponent: Error fetching members for Hiyaw Mahider ${currentUser.assignedHiyawMahider}:`, error);
              this.errorMessage = `Failed to load members for your Hiyaw Mahider. Ensure it's correctly assigned.`;
              this.isLoading = false;
              return of([]);
            })
          );
        } else {
          console.warn('MembersListComponent: switchMap: Authenticated user is not Admin and has no assigned Hiyaw Mahider. Returning empty array.');
          this.errorMessage = 'You are not assigned to a Hiyaw Mahider. Please contact your administrator.';
          this.isLoading = false;
          return of([]);
        }
      }),
      catchError(outerError => {
        console.error('MembersListComponent: Outer stream error:', outerError);
        this.errorMessage = 'An unexpected error occurred while loading members.';
        this.isLoading = false;
        return of([]);
      }),
      takeUntil(this.destroy$)
    )
    .subscribe(
      members => {
        console.log('MembersListComponent: Final members$ subscription received:', members);
        this.members$ = of(members);
      },
      error => {
        console.error('MembersListComponent: Top-level subscription error:', error);
        this.errorMessage = 'An unhandled error occurred.';
        this.isLoading = false;
      },
      () => {
        console.log('MembersListComponent: Top-level subscription completed.');
        this.isLoading = false;
      }
    );
  }

  // Add this new method for pagination
  updatePaginatedMembers(allMembers: User[]) {
    const startIndex = this.pageIndex * this.pageSize;
    this.paginatedMembers = allMembers.slice(startIndex, startIndex + this.pageSize);
  }

  // Add this new method for page change event
  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.members$.subscribe(members => {
      this.updatePaginatedMembers(members);
    });
  }

  ngOnDestroy(): void {
    console.log('MembersListComponent ngOnDestroy: Cleaning up subscriptions.');
    this.destroy$.next();
    this.destroy$.complete();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      console.log('MembersListComponent: authSubscription unsubscribed.');
    }
  }
}