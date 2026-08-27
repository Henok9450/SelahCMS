// members-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, of, Subject, Subscription } from 'rxjs';
import { switchMap, tap, catchError, takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
import { Member } from '../../core/models/member.model';
import { AuthService } from '../../core/services/auth.service';
import { MemberService } from '../../core/services/member.service';
import { HiyawMahiderService } from '../../core/services/hiyaw-mahider.service';

@Component({
  selector: 'app-members-list',
  templateUrl: './members-list.component.html',
  styleUrls: ['./members-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
  ],
})
export class MembersListComponent implements OnInit, OnDestroy {
  members$: Observable<Member[]> = of([]);
  allLoadedMembers: Member[] = [];
  filteredMembers: Member[] = [];
  paginatedMembers: Member[] = [];

  isLoading: boolean = true;
  errorMessage: string | null = null;
  hiyawMahiderName: string = '';
  assignedHiyawMahiderId: string | null = null;

  // View Mode: 'grid' (directory cards) or 'table' (tabular view)
  viewMode: 'grid' | 'table' = 'grid';

  // Member details modal
  selectedMember: Member | null = null;

  // Search & Filter state
  searchTerm: string = '';
  selectedRole: string = 'All';
  availableRoles: string[] = ['All', 'Member', 'Pastor', 'Deputy Pastor', 'Zone Coordinator', 'Admin'];

  // Pagination variables
  pageSize = 12;
  pageIndex = 0;
  pageSizeOptions = [6, 12, 24, 48];
  totalMembers = 0;

  private destroy$ = new Subject<void>();
  private authSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private memberService: MemberService,
    private hiyawMahiderService: HiyawMahiderService
  ) {
    console.log('👥 [MEMBERS-LIST] Component constructor initialized');
  }

  ngOnInit(): void {
    console.log('👥 [MEMBERS-LIST] Component initialized - Setting up auth state subscription');

    this.authSubscription = this.authService.authState$.pipe(
      distinctUntilChanged((prev: any, curr: any) => prev?.uid === curr?.uid),
      tap(currentUser => {
        console.log('👤 [MEMBERS-LIST] Auth state received:', {
          role: currentUser?.role,
          assignedHiyawMahider: currentUser?.assignedHiyawMahider
        });
        this.isLoading = true;
        this.errorMessage = null;
      }),
      switchMap(currentUser => {
        if (!currentUser) {
          console.warn('⚠️ [MEMBERS-LIST] No current user - returning empty array');
          this.errorMessage = 'User not authenticated. Please log in.';
          this.isLoading = false;
          return of([] as Member[]);
        }

        const hiyawMahiderId = currentUser.assignedHiyawMahider;
        this.assignedHiyawMahiderId = hiyawMahiderId || null;
        console.log(`🔍 [MEMBERS-LIST] User role: '${currentUser.role}', assignedHiyawMahider: ${hiyawMahiderId}`);

        if (hiyawMahiderId) {
          // Fetch Hiyaw Mahider name for title
          this.hiyawMahiderService.getHiyawMahiderName(hiyawMahiderId).pipe(
            takeUntil(this.destroy$)
          ).subscribe(name => {
            this.hiyawMahiderName = name || 'My Fellowship Group';
          });

          console.log(`👥 [MEMBERS-LIST] Loading members for Hiyaw Mahider: ${hiyawMahiderId}`);
          return this.memberService.getMembersPaged({
            status: 'active',
            includes: ['smallTeam'],
            page: 1,
            pageSize: 500
          }).pipe(
            map(response => {
              const allMembers = response.data || [];
              const filtered = allMembers.filter(m => m.hyaw_mahider_id === hiyawMahiderId);
              this.isLoading = false;
              this.setMembers(filtered);
              return filtered;
            }),
            catchError(error => {
              console.error(`❌ [MEMBERS-LIST] Error fetching members:`, error);
              this.errorMessage = `Failed to load members for your Hiyaw Mahider. Ensure it's correctly assigned.`;
              this.isLoading = false;
              return of([] as Member[]);
            })
          ) as Observable<Member[]>;
        } else if (currentUser.role === 'Admin') {
          this.hiyawMahiderName = 'All Fellowship Members (Admin View)';
          console.log('👥 [MEMBERS-LIST] Admin - Loading ALL active members...');
          return this.memberService.getMembersPaged({
            status: 'active',
            includes: ['smallTeam'],
            page: 1,
            pageSize: 500
          }).pipe(
            tap(response => {
              const members = response.data || [];
              this.isLoading = false;
              this.setMembers(members);
            }),
            map(response => response.data || []),
            catchError(error => {
              console.error('❌ [MEMBERS-LIST] Error fetching all members for Admin:', error);
              this.errorMessage = 'Failed to load all members. Please try again.';
              this.isLoading = false;
              return of([] as Member[]);
            })
          ) as Observable<Member[]>;
        } else {
          this.errorMessage = 'You are not assigned to a Hiyaw Mahider. Please contact your administrator.';
          this.isLoading = false;
          return of([] as Member[]);
        }
      }),
      catchError(outerError => {
        console.error('❌ [MEMBERS-LIST] Outer stream error:', outerError);
        this.errorMessage = 'An unexpected error occurred while loading members.';
        this.isLoading = false;
        return of([] as Member[]);
      }),
      takeUntil(this.destroy$)
    ).subscribe(
      members => {
        this.members$ = of(members);
      },
      error => {
        console.error('❌ [MEMBERS-LIST] Top-level subscription error:', error);
        this.errorMessage = 'An unhandled error occurred.';
        this.isLoading = false;
      }
    );
  }

  setMembers(members: Member[]): void {
    this.allLoadedMembers = members;
    this.applyLocalFilters();
  }

  // Filter logic (focused on fellowship connections: name, phone, role, email)
  applyLocalFilters(): void {
    let result = [...this.allLoadedMembers];

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(m =>
        (m.full_name && m.full_name.toLowerCase().includes(term)) ||
        (m.phone && m.phone.toLowerCase().includes(term)) ||
        (m.role && m.role.toLowerCase().includes(term)) ||
        (m.email && m.email.toLowerCase().includes(term))
      );
    }

    if (this.selectedRole && this.selectedRole !== 'All') {
      result = result.filter(m => m.role === this.selectedRole);
    }

    this.filteredMembers = result;
    this.totalMembers = result.length;
    this.pageIndex = 0;
    this.updatePaginatedMembers();
  }

  onSearchChange(): void {
    this.applyLocalFilters();
  }

  setRoleFilter(role: string): void {
    this.selectedRole = role;
    this.applyLocalFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'All';
    this.applyLocalFilters();
  }

  hasActiveFilters(): boolean {
    return (this.searchTerm.trim() !== '') || (this.selectedRole !== 'All');
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
    this.pageSize = mode === 'grid' ? 12 : 10;
    this.pageSizeOptions = mode === 'grid' ? [6, 12, 24, 48] : [5, 10, 25, 50];
    this.pageIndex = 0;
    this.updatePaginatedMembers();
  }

  // View member detail modal
  openMemberDetails(member: Member): void {
    this.selectedMember = member;
  }

  closeMemberDetails(): void {
    this.selectedMember = null;
  }

  // Getters for role counts
  get totalCount(): number {
    return this.allLoadedMembers.length;
  }

  getRoleCount(role: string): number {
    if (role === 'All') return this.allLoadedMembers.length;
    return this.allLoadedMembers.filter(m => m.role === role).length;
  }

  // Pagination method
  updatePaginatedMembers(): void {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedMembers = this.filteredMembers.slice(startIndex, endIndex);
  }

  // Page change event handler
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedMembers();
  }

  // Helper methods
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getRoleIcon(role?: string): string {
    switch (role) {
      case 'Pastor': return 'person';
      case 'Deputy Pastor': return 'person_outline';
      case 'Zone Coordinator': return 'admin_panel_settings';
      case 'Admin': return 'shield';
      default: return 'how_to_reg';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}
