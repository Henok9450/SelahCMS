import { Component, OnInit, ViewChild, AfterViewInit, TemplateRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HiyawMahiderService } from '../../core/services/hiyaw-mahider.service';
import { PastorService } from '../../core/services/pastor.service';
import { ZoneService } from '../../core/services/zone.service';
import { MemberService } from '../../core/services/member.service';
import { HiyawMahider, HiyawMahiderStatus } from '../../core/models/hiyaw-mahider.model';
import { Pastor } from '../../core/models/pastor.model';
import { Zone } from '../../core/models/zone.model';
import { Member, UserRole } from '../../core/models/member.model';
import { Observable, catchError, of, tap, forkJoin, from, concatMap, reduce, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuditLogService } from '../../core/services/audit-log.service';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions'; // Removed httpsCallable import
import { initializeApp, deleteApp } from 'firebase/app'; // New imports
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth'; // New imports
import { environment } from '../../../environments/environment'; // Environment import
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-hiyaw-mahider',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatDialogModule,
    MatChipsModule
  ],
  templateUrl: './hiyaw-mahider.component.html',
  styleUrls: ['./hiyaw-mahider.component.css']
})
export class HiyawMahiderComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  // Mat-Table properties
  displayedColumns: string[] = [
    'code', 'name', 'location', 'hostName', 'hostContactNumber',
    'zone', 'status', 'pastor', 'deputyPastor', 'study',
    'memberCount', 'actions', 'createdDate'
  ];
  dataSource = new MatTableDataSource<HiyawMahider>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('assignmentActionDialog') assignmentActionDialog!: TemplateRef<any>;

  newHiyawMahider: Omit<HiyawMahider, 'id' | 'createdDate'>;
  searchFilters = {
    name: '',
    pastor: '',
    deputyPastor: '',
    status: '' as HiyawMahiderStatus | '',
    code: '',
    location: '',
    zone: ''
  };
  // Add to your component properties
  assignmentErrorMessage: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  codeError: string | null = null;
  initialLoadComplete = false;

  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  statusOptions: HiyawMahiderStatus[];

  // Pastor selection properties
  pastors: Pastor[] = [];
  filteredPastorsCreate: Pastor[] = [];
  filteredDeputyPastorsCreate: Pastor[] = [];
  filteredPastorsEdit: Pastor[] = [];
  filteredDeputyPastorsEdit: Pastor[] = [];

  pastorSearchTermCreate = '';
  deputyPastorSearchTermCreate = '';
  pastorSearchTermEdit = '';
  deputyPastorSearchTermEdit = '';

  zones: Zone[] = [];

  // Edit mode properties
  editingItem: HiyawMahider | null = null;
  isEditMode = false;
  processingIds: Set<string> = new Set();

  // Add mode properties
  isAdding = false;
  addingItem: Omit<HiyawMahider, 'id' | 'createdDate'> | null = null;

  // Member management properties
  members: Member[] = [];
  filteredMembers: Member[] = [];
  memberSearchTerm = '';
  isSearchingMembers = false;
  private memberSearchTimeout: any;

  // Use Map for all Hiyaw Mahiders, and array for current dialog
  assignedMembersMap: Map<string, Member[]> = new Map(); // For all Hiyaw Mahiders
  assignedMembers: Member[] = []; // For current assignment dialog only

  showMemberAssignment = false;
  selectedHiyawMahiderForAssignment: HiyawMahider | null = null;
  availableRoles: UserRole[] = [];
  isLoadingMembers = false;
  corsWarning = false;

  // View assigned members properties
  showViewMembers = false;
  selectedHiyawMahiderForView: HiyawMahider | null = null;
  viewAssignedMembers: Member[] = [];

  // 🆕 NEW: Role update tracking
  updatingRoles: Set<string> = new Set();

  constructor(
    private hiyawMahiderService: HiyawMahiderService,
    private pastorService: PastorService,
    private zoneService: ZoneService,
    private memberService: MemberService,
    private auth: Auth,
    private functions: Functions,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private auditLogService: AuditLogService
  ) {
    this.statusOptions = this.hiyawMahiderService.getStatusOptions();
    this.newHiyawMahider = this.getDefaultHiyawMahider();
    this.availableRoles = this.memberService.getRoleOptions();
  }

  ngOnInit(): void {
    this.loadPastors();
    this.loadZones();
    this.loadHiyawMahiders();
    this.testApiConnection();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🆕 NEW: Start Add mode
  startAdd(): void {
    this.isAdding = true;
    this.addingItem = this.getDefaultHiyawMahider();
    this.pastorSearchTermCreate = '';
    this.deputyPastorSearchTermCreate = '';
    this.filterPastors('', 'create', 'pastor');
    this.filterPastors('', 'create', 'deputyPastor');
    this.successMessage = null;
    this.errorMessage = null;
    this.codeError = null;
  }

  // 🆕 NEW: Cancel Add mode
  cancelAdd(): void {
    this.isAdding = false;
    this.addingItem = null;
    this.errorMessage = null;
    this.successMessage = null;
  }

  // 🆕 NEW: Save Add mode
  async saveAdd(): Promise<void> {
    if (!this.addingItem) return;

    if (!this.validateAddForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.codeError = null;

    try {
      const codeExists = await this.hiyawMahiderService.isCodeExists(this.addingItem.code);
      if (codeExists) {
        this.codeError = 'This code is already in use';
        this.isLoading = false;
        return;
      }

      const exists = await this.hiyawMahiderService.isHiyawMahiderExists(
        this.addingItem.name,
        this.addingItem.location
      );

      if (exists) {
        this.errorMessage = 'A Hiyaw Mahider with this name and location already exists';
        this.isLoading = false;
        return;
      }

      const created = await this.hiyawMahiderService.createHiyawMahider({
        ...this.addingItem,
        code: this.addingItem.code.trim()
      });

      this.auditLogService.log('HIYAW_MAHIDER_CREATED', 'Hiyaw Mahider', created.id, created.name, created);
      this.successMessage = `Hiyaw Mahider "${created.name}" created successfully with code "${created.code}"`;
      this.isAdding = false;
      this.addingItem = null;
      this.loadHiyawMahiders();
      setTimeout(() => this.successMessage = null, 5000);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to create Hiyaw Mahider. Please try again.';
      console.error('Error creating Hiyaw Mahider:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // 🆕 NEW: Validate Add form
  private validateAddForm(): boolean {
    if (!this.addingItem) return false;

    this.errorMessage = null;
    this.codeError = null;

    if (!this.addingItem.name?.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (!this.addingItem.HostName?.trim()) {
      this.errorMessage = 'Host Name is required';
      return false;
    }
    if (!this.addingItem.HostContactNumber?.trim()) {
      this.errorMessage = 'Host Contact Number is required';
      return false;
    }
    if (!this.addingItem.location?.trim()) {
      this.errorMessage = 'Location is required';
      return false;
    }
    if (!this.addingItem.code?.trim()) {
      this.codeError = 'Code is required';
      return false;
    }
    if (!/^[A-Za-z0-9\-_]+$/.test(this.addingItem.code)) {
      this.codeError = 'Code can only contain letters, numbers, hyphens, and underscores';
      return false;
    }

    return true;
  }

  // 🆕 ENHANCED: Open view members dialog with role editing
  openViewMembers(hiyawMahider: HiyawMahider): void {
    this.selectedHiyawMahiderForView = hiyawMahider;
    this.showViewMembers = true;

    // Get assigned members from the Map
    this.viewAssignedMembers = this.assignedMembersMap.get(hiyawMahider.id) || [];

    // If not in Map, load them
    if (this.viewAssignedMembers.length === 0) {
      this.loadViewAssignedMembers(hiyawMahider.id);
    }
  }

  // 🆕 ENHANCED: Load assigned members for view dialog with role editing (local-first)
  loadViewAssignedMembers(hiyawMahiderId: string): void {
    // Prefer local members list if already loaded
    if (this.members && this.members.length > 0) {
      const assigned = this.members.filter(m => m.hyaw_mahider_id === hiyawMahiderId);
      this.viewAssignedMembers = assigned;
      this.assignedMembersMap.set(hiyawMahiderId, assigned);
      return;
    }

    // Fallback to API if local members are not available
    this.memberService.getMembers({
      includes: ['smallTeam'],
      hiyawMahiderId: hiyawMahiderId
    }).subscribe({
      next: (response) => {
        this.viewAssignedMembers = response.data || [];
        this.assignedMembersMap.set(hiyawMahiderId, this.viewAssignedMembers);
      },
      error: (error) => {
        console.error('❌ Error loading assigned members for view:', error);
        this.viewAssignedMembers = [];
      }
    });
  }

  // 🆕 ENHANCED: Close view members dialog
  closeViewMembers(): void {
    this.showViewMembers = false;
    this.selectedHiyawMahiderForView = null;
    this.viewAssignedMembers = [];
    this.updatingRoles.clear();
  }

  // 🆕 SIMPLIFIED: Update member role
  updateMemberRole(member: Member, newRole: UserRole): void {
    if (this.corsWarning) {
      this.errorMessage = 'Cannot update roles due to CORS restrictions. Please resolve CORS issues first.';
      return;
    }

    const oldRole = member.role;

    if (oldRole === newRole) {
      return; // No change needed
    }

    console.log(`🔄 Updating role for ${member.full_name} from ${oldRole} to ${newRole}`);

    // Show loading state
    this.updatingRoles.add(member.id);

    this.memberService.updateMemberRole(member.id, newRole).subscribe({
      next: (updatedMember) => {
        console.log('✅ Role update successful');
        this.successMessage = `✅ Role updated to ${newRole} for ${member.full_name}`;

        // Update the role in ALL local arrays
        this.updateRoleInAllArrays(member.id, newRole);

        // Remove loading state
        this.updatingRoles.delete(member.id);

        setTimeout(() => this.successMessage = null, 5000);
      },
      error: (error) => {
        console.error('❌ Role update failed:', error);
        this.updatingRoles.delete(member.id);

        if (this.isCorsError(error)) {
          this.errorMessage = `CORS Error: Cannot update role. Please check browser CORS settings.`;
          this.handleCorsError();
        } else {
          this.errorMessage = `Failed to update role: ${error.message}`;
        }

        setTimeout(() => this.errorMessage = null, 5000);
      }
    });
  }

  // 🆕 NEW: Simple method to update role in all arrays
  private updateRoleInAllArrays(memberId: string, newRole: UserRole): void {
    console.log(`🔄 Updating role to ${newRole} for member ${memberId} in all arrays`);

    // Helper function to update role in an array
    const updateRoleInArray = (array: Member[]) => {
      const index = array.findIndex(m => m.id === memberId);
      if (index !== -1) {
        array[index].role = newRole;
      }
    };

    // Update in all arrays
    updateRoleInArray(this.viewAssignedMembers);
    updateRoleInArray(this.members);
    updateRoleInArray(this.filteredMembers);
    updateRoleInArray(this.assignedMembers);

    // Update in assignedMembersMap
    this.assignedMembersMap.forEach((members, key) => {
      updateRoleInArray(members);
    });

    // Force UI refresh
    this.viewAssignedMembers = [...this.viewAssignedMembers];
    this.assignedMembers = [...this.assignedMembers];
    this.filteredMembers = [...this.filteredMembers];
    this.dataSource.data = [...this.dataSource.data];

    console.log('✅ Role updated in all local arrays');
  }

  // 🆕 NEW: Helper method to update member in all local arrays
  private updateMemberInAllLocalArrays(updatedMember: Member, memberId: string): void {
    console.log('🔄 Updating member in all local arrays:', updatedMember);

    // Update member in viewAssignedMembers
    const viewIndex = this.viewAssignedMembers.findIndex(m => m.id === memberId);
    if (viewIndex !== -1) {
      this.viewAssignedMembers[viewIndex] = updatedMember;
    }

    // Update member in main members array
    const mainIndex = this.members.findIndex(m => m.id === memberId);
    if (mainIndex !== -1) {
      this.members[mainIndex] = updatedMember;
    }

    // Update member in assignedMembersMap
    if (this.selectedHiyawMahiderForView) {
      const currentAssigned = this.assignedMembersMap.get(this.selectedHiyawMahiderForView.id) || [];
      const assignedIndex = currentAssigned.findIndex(m => m.id === memberId);
      if (assignedIndex !== -1) {
        currentAssigned[assignedIndex] = updatedMember;
        this.assignedMembersMap.set(this.selectedHiyawMahiderForView.id, currentAssigned);
      }
    }

    // Update member in assignedMembers (for assignment dialog)
    const assignedIndex = this.assignedMembers.findIndex(m => m.id === memberId);
    if (assignedIndex !== -1) {
      this.assignedMembers[assignedIndex] = updatedMember;
    }

    // Update member in filteredMembers
    const filteredIndex = this.filteredMembers.findIndex(m => m.id === memberId);
    if (filteredIndex !== -1) {
      this.filteredMembers[filteredIndex] = updatedMember;
    }

    // Force UI refresh
    this.viewAssignedMembers = [...this.viewAssignedMembers];
    this.assignedMembers = [...this.assignedMembers];
    this.filteredMembers = [...this.filteredMembers];

    // Refresh the main table to update counts
    this.dataSource.data = [...this.dataSource.data];
  }

  // 🆕 NEW: Check if member is currently updating role
  isMemberUpdating(memberId: string): boolean {
    return this.updatingRoles.has(memberId);
  }

  // 🆕 NEW: Force refresh member data
  refreshMemberData(): void {
    if (!this.selectedHiyawMahiderForView) return;

    console.log('🔄 Force refreshing member data...');
    this.isLoading = true;

    this.loadViewAssignedMembers(this.selectedHiyawMahiderForView.id);

    // Also refresh the main members list
    this.loadMembers();

    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Member data refreshed';
      setTimeout(() => this.successMessage = null, 3000);
    }, 1000);
  }

  // 🆕 UPDATED: Add Members - Focus on adding new members only
  openAddMembers(): void {
    if (!this.selectedHiyawMahiderForView) {
      console.error('❌ No Hiyaw Mahider selected');
      return;
    }

    console.log('➕ Opening Add Members mode for:', this.selectedHiyawMahiderForView.name);

    const hiyawMahiderToManage = { ...this.selectedHiyawMahiderForView };

    // Close the view dialog
    this.closeViewMembers();

    // Open management dialog in "add mode"
    setTimeout(() => {
      this.openMemberAssignmentWithMode(hiyawMahiderToManage, 'add');
    }, 100);
  }

  // 🆕 UPDATED: Advanced Management - Full control with enhanced features
  openAdvancedManagement(): void {
    if (!this.selectedHiyawMahiderForView) {
      console.error('❌ No Hiyaw Mahider selected');
      return;
    }

    console.log('⚙️ Opening Advanced Management mode for:', this.selectedHiyawMahiderForView.name);

    const hiyawMahiderToManage = { ...this.selectedHiyawMahiderForView };

    // Close the view dialog
    this.closeViewMembers();

    // Open management dialog with enhanced features
    setTimeout(() => {
      this.openMemberAssignmentWithMode(hiyawMahiderToManage, 'manage');
    }, 100);
  }

  // 🆕 NEW: Open member assignment with different modes
  openMemberAssignmentWithMode(hiyawMahider: HiyawMahider, mode: 'add' | 'manage' = 'manage'): void {
    if (this.corsWarning) {
      this.provideCorsSolutions();
      return;
    }

    this.selectedHiyawMahiderForAssignment = hiyawMahider;
    this.showMemberAssignment = true;
    this.memberSearchTerm = '';

    // Set assignedMembers for dialog from the Map
    this.assignedMembers = this.assignedMembersMap.get(hiyawMahider.id) || [];

    // Set mode-specific behavior
    if (mode === 'add') {
      console.log('🎯 Add Mode: Focusing on available members section');
      // Auto-focus search input after dialog renders
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder*="Search Members"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          console.log('🔍 Search input focused for Add Members mode');
        }
      }, 300);
    } else {
      console.log('🎯 Manage Mode: Full management capabilities enabled');
    }

    // Load members for assignment
    this.loadMembers();
  }

  // In HiyawMahiderComponent - Updated assignMemberToHiyawMahider method
  assignMemberToHiyawMahider(member: Member, role: UserRole): void {
    console.log('🔄 ASSIGNING:', member.full_name, 'as', role);

    // Clear any previous assignment errors
    this.assignmentErrorMessage = null;
    this.successMessage = null;

    if (!this.selectedHiyawMahiderForAssignment) {
      this.assignmentErrorMessage = 'Please select a Hiyaw Mahider first';
      return;
    }

    // ... (existing code)

    // 1. Check if user needs account creation or has a "Stale UID"
    const auth = getAuth();

    // We wrapped this in an async function to handle the await, but we call it immediately
    (async () => {
      try {
        if (!member.firebase_uid) {
          await this.handleUserCreationAndAssignment(member, role);
          return;
        }

        // 🕵️‍♀️ STALE UID CHECK: Member has UID, but does user exist in Firebase?
        console.log(`🕵️ Verifying existence of user ${member.email} in Firebase...`);
        const methods = await fetchSignInMethodsForEmail(auth, member.email!);

        if (methods.length === 0) {
          console.warn(`🧟 STALE UID DETECTED: Member ${member.full_name} has UID ${member.firebase_uid} but no Firebase User found!`);
          console.log('🧹 Clearing stale UID and re-creating account...');
          // Treat as new user
          member.firebase_uid = undefined; // Clear the stale UID locally
          await this.handleUserCreationAndAssignment(member, role);
        } else {
          console.log(`✅ User exists in Firebase (Methods: ${methods.join(', ')}). Proceeding with assignment.`);
          // User exists, proceed with linking/assignment
          this.executeMemberAssignment(member, role);
        }
      } catch (error) {
        console.warn('⚠️ Error checking Firebase user existence (might be network or privacy protection). Proceeding with existing UID assumptions.', error);
        // Fallback: If verification fails, assume UID is valid to be safe, or just try assignment
        this.executeMemberAssignment(member, role);
      }
    })();
  }

  private async handleUserCreationAndAssignment(member: Member, role: UserRole): Promise<void> {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const hasValidEmail = member.email && emailRegex.test(member.email);

    if (!hasValidEmail) {
      const msg = `⚠️ Member ${member.full_name} has no valid email. Skipping account creation.`;
      console.warn(msg);

      this.snackBar.open(msg, 'Dismiss', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['warning-snackbar']
      });

      this.executeMemberAssignment(member, role);
      return;
    }

    try {
      const loadingRef = this.snackBar.open("Creating user account...", undefined, {
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });

      // Create user using Secondary App to avoid logging out the admin
      const newUid = await this.createUserWithSecondaryApp(member);

      loadingRef.dismiss();

      if (newUid) {
        this.snackBar.open("✅ User account created successfully", 'Close', {
          duration: 3000,
          verticalPosition: 'top',
          horizontalPosition: 'center',
          panelClass: ['success-snackbar']
        });
        member.firebase_uid = newUid;
      }

    } catch (error: any) {
      console.error('❌ Error creating user account:', error);

      let errorMsg = `⚠️ Account creation failed: ${error.message}`;

      // Check for "email-already-in-use" specific error
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = "⚠️ Account already exists in Firebase! The member must log in to link their account.";
        console.warn('⚠️ Email already in use. Skipping automatic linking for now. Account linking will happen on next login.');
      }

      this.snackBar.open(errorMsg, 'OK', {
        duration: 8000, // Longer duration for reading
        verticalPosition: 'top',
        horizontalPosition: 'center',
        panelClass: ['warning-snackbar']
      });
    }

    // Finally, proceed with assignment
    this.executeMemberAssignment(member, role);
  }

  // 🆕 Helper: Create user without logging out admin
  private async createUserWithSecondaryApp(member: Member): Promise<string | null> {
    console.log('🔄 Initializing Secondary App for user creation...');
    const secondaryApp = initializeApp(environment.firebase, 'Secondary');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const firstName = member.first_name || member.full_name.split(' ')[0];
      const lastName = member.last_name || member.full_name.split(' ').slice(1).join(' ') || '';
      const displayName = `${firstName} ${lastName}`.trim();

      // Generate a random temporary password
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + 'Aa1!';
      console.log(`👤 Creating user for: ${member.email} with random temp password.`);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, member.email!, randomPassword);
      const user = userCredential.user;

      console.log('✅ User created on Secondary App:', user.uid);

      await updateProfile(user, {
        displayName: displayName
      });

      console.log('✅ Profile updated on Secondary App');

      // Send password reset email immediately
      await sendPasswordResetEmail(secondaryAuth, member.email!);
      console.log('📧 Password reset email sent to:', member.email);

      console.log('✅ Profile updated on Secondary App');

      // Return the new UID
      return user.uid;

    } catch (error: any) {
      // Re-throw to be handled by caller (including email-already-in-use)
      throw error;
    } finally {
      // CLEANUP: Always sign out and delete the secondary app
      console.log('🧹 Cleaning up Secondary App...');
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
    }
  }

  private executeMemberAssignment(member: Member, role: UserRole): void {
    const selectedHiyawId = this.selectedHiyawMahiderForAssignment!.id;
    const newHiyawName = this.selectedHiyawMahiderForAssignment!.name;

    // Get the name of the current Hiyaw Mahider the member is assigned to (if any)
    let currentHiyawName = '';
    if (member.hyaw_mahider_id) {
      const currentHiyaw = this.dataSource.data.find(hm => hm.id === member.hyaw_mahider_id);
      currentHiyawName = currentHiyaw ? currentHiyaw.name : 'another Hiyaw Mahider';
    }

    this.updatingRoles.add(member.id);

    this.memberService.assignMemberToHiyawMahider(
      member.id,
      selectedHiyawId,
      role,
      currentHiyawName,
      newHiyawName,
      member.firebase_uid // 🆕 NEW: Pass the UID for sync
    ).subscribe({
      next: (updatedMember) => {
        console.log('✅ Assignment successful');

        // Update role in all arrays
        this.updateRoleInAllArrays(member.id, role);

        // Refresh assigned members
        this.loadAssignedMembers(selectedHiyawId);

        // Update the local member object
        member.hyaw_mahider_id = selectedHiyawId;
        member.role = role;

        // Show final success message (overwriting any previous interim messages)
        const successMsg = `✅ ${member.full_name} assigned as ${role} to ${newHiyawName}`;
        this.snackBar.open(successMsg, 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });

        this.updatingRoles.delete(member.id);
      },
      error: (error) => {
        console.error('❌ Assignment failed:', error);
        this.updatingRoles.delete(member.id);

        // Set the assignment dialog error message
        const errorMsg = error.message || `Failed to assign member: ${error}`;
        this.snackBar.open(errorMsg, 'Close', {
          duration: 8000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  // 🆕 UPDATED: Remove member from Hiyaw Mahider
  removeMemberFromHiyawMahider(member: Member): void {
    if (!this.selectedHiyawMahiderForView) {
      console.error('❌ No Hiyaw Mahider selected');
      return;
    }

    const hiyawMahiderName = this.selectedHiyawMahiderForView.name;
    const memberName = member.full_name;

    if (!confirm(`Are you sure you want to remove ${memberName} from ${hiyawMahiderName}?`)) {
      return;
    }

    console.log(`🗑️ Removing member ${memberName} from ${hiyawMahiderName} by setting hyaw_mahider_id to null`);

    this.memberService.removeMemberFromHiyawMahider(member.id).subscribe({
      next: (updatedMember) => {
        console.log('✅ Member removal successful', updatedMember);
        this.successMessage = `✅ Member ${memberName} removed from ${hiyawMahiderName}`;

        // Update local members list
        const index = this.members.findIndex(m => m.id === member.id);
        if (index !== -1) {
          this.members[index] = updatedMember;
        }

        // Refresh the view
        this.loadViewAssignedMembers(this.selectedHiyawMahiderForView!.id);

        // Also refresh the main table to update counts
        this.dataSource.data = [...this.dataSource.data];

        setTimeout(() => this.successMessage = null, 5000);
      },
      error: (error) => {
        console.error('❌ Member removal failed', error);

        if (error.status === 404) {
          this.errorMessage = `Remove endpoint not found. The API may not support member removal.`;
        } else if (error.status === 401) {
          this.errorMessage = `Authentication failed. Please log in again.`;
        } else {
          this.errorMessage = `Failed to remove member: ${error.message}`;
        }
      }
    });
  }

  // 🆕 UPDATED: Remove all members from Hiyaw Mahider
  removeAllMembers(): void {
    if (!this.selectedHiyawMahiderForView || this.viewAssignedMembers.length === 0) {
      return;
    }

    const hiyawMahiderName = this.selectedHiyawMahiderForView.name;
    const memberCount = this.viewAssignedMembers.length;

    if (!confirm(`Are you sure you want to remove ALL ${memberCount} members from ${hiyawMahiderName}? This action cannot be undone.`)) {
      return;
    }

    console.log(`🗑️ Removing all ${memberCount} members from ${hiyawMahiderName}`);

    // Create an array of all removal observables
    const removalObservables = this.viewAssignedMembers.map(member =>
      this.memberService.removeMemberFromHiyawMahider(member.id)
    );

    // Execute all removals
    this.isLoading = true;
    forkJoin(removalObservables).subscribe({
      next: (results) => {
        console.log('✅ All members removed successfully', results);
        this.successMessage = `✅ All ${memberCount} members removed from ${hiyawMahiderName}`;
        this.isLoading = false;

        // Refresh the view
        this.loadViewAssignedMembers(this.selectedHiyawMahiderForView!.id);

        setTimeout(() => this.successMessage = null, 5000);
      },
      error: (error) => {
        console.error('❌ Error removing members', error);
        this.errorMessage = `Failed to remove some members: ${error.message}`;
        this.isLoading = false;

        // Refresh anyway to get current state
        this.loadViewAssignedMembers(this.selectedHiyawMahiderForView!.id);
      }
    });
  }

  // 🆕 NEW: Helper method to get role count for view dialog
  getRoleCount(role: string): number {
    if (!this.viewAssignedMembers) return 0;
    return this.viewAssignedMembers.filter(member => member.role === role).length;
  }

  // Test API connection with detailed diagnostics
  testApiConnection(): void {
    console.log('🧪 Testing API connection with detailed diagnostics...');

    this.memberService.testApiConnection().subscribe({
      next: (response) => {
        console.log('✅ API Connection Test: SUCCESS - API is accessible');
        console.log('📊 API Response Structure:', response);
        this.corsWarning = false;
        this.loadMembers();
      },
      error: (error) => {
        console.error('❌ API Connection Test: FAILED', error);

        if (error.status === 401 || error.status === 403) {
          console.log('🔐 Authentication issue - checking Firebase auth state');
          this.checkAuthState();
        } else if (this.isCorsError(error)) {
          console.log('🚨 CORS error detected - enabling fallback mode');
          this.handleCorsError();
          // Still try to load members (GET might work even if PATCH doesn't)
          this.loadMembers();
        } else {
          this.errorMessage = `API Connection Failed: ${error.message}`;
          // Try to load members anyway
          this.loadMembers();
        }
      }
    });
  }

  // Check Firebase authentication state
  private checkAuthState(): void {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('🔑 User is authenticated:', user.email);
        user.getIdToken().then(token => {
          console.log('🔑 Token available:', token ? 'Yes' : 'No');
          // Retry member loading with fresh token
          this.loadMembers();
        });
      } else {
        console.error('🔐 No user authenticated');
        this.errorMessage = 'Please log in to access member data.';
      }
    });
  }

  // Check if error is CORS-related
  private isCorsError(error: any): boolean {
    return error.status === 0 ||
      error.name === 'HttpErrorResponse' &&
      error.message?.includes('CORS') ||
      error.message?.includes('cross-origin') ||
      error.message?.includes('Network Error');
  }

  // Enhanced CORS error handler
  private handleCorsError(): void {
    this.corsWarning = true;
    this.errorMessage = `
      CORS Issue Detected - Member Assignment Features Limited
    
      🔧 QUICK FIXES FOR DEVELOPMENT:
      
      1. Install CORS Browser Extension:
         • Chrome: CORS Unblock
         • Firefox: CORS Everywhere
         
      2. Run Chrome with disabled security:
         chrome.exe --disable-web-security --user-data-dir="C:/ChromeDev"
         
      3. Use Angular Proxy (recommended):
         • Create proxy.conf.json in project root
         • Run: ng serve --proxy-config proxy.conf.json
      
      🚨 PRODUCTION SOLUTION:
      Contact API team to add these CORS headers:
      • Access-Control-Allow-Origin: your-domain.com
      • Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE
      • Access-Control-Allow-Headers: Authorization, Content-Type
    `;

    console.warn('🔧 CORS Issue Detected - Member assignment features disabled');
  }

  // Provide CORS solutions to user
  provideCorsSolutions(): void {
    const solutions = `
      IMMEDIATE SOLUTIONS:
      
      1. Click "Install CORS Extension" button below
      2. OR Run Chrome with disabled security
      3. OR Use the proxy configuration
      
      The API can fetch members but cannot assign them due to CORS restrictions on PATCH requests.
    `;

    this.errorMessage = solutions;

    // Auto-suggest CORS extension installation
    setTimeout(() => {
      const install = confirm(
        'CORS issue detected. Would you like to install a CORS browser extension for development?'
      );
      if (install) {
        this.installCorsExtension();
      }
    }, 1000);
  }

  // Get only active pastors
  getActivePastors(): Pastor[] {
    return this.pastors.filter(pastor => pastor.status === 'Active');
  }

  handlePastorInput(event: Event, fieldType: 'pastor' | 'deputyPastor', formType: 'create' | 'edit' | 'add'): void {
    const inputElement = event.target as HTMLInputElement;
    const searchTerm = inputElement.value;

    if (formType === 'create' || formType === 'add') {
      if (fieldType === 'pastor') {
        this.pastorSearchTermCreate = searchTerm;
        this.filterPastors(this.pastorSearchTermCreate, 'create', 'pastor');
      } else {
        this.deputyPastorSearchTermCreate = searchTerm;
        this.filterPastors(this.deputyPastorSearchTermCreate, 'create', 'deputyPastor');
      }
    } else {
      if (fieldType === 'pastor') {
        this.pastorSearchTermEdit = searchTerm;
        this.filterPastors(this.pastorSearchTermEdit, 'edit', 'pastor');
      } else {
        this.deputyPastorSearchTermEdit = searchTerm;
        this.filterPastors(this.deputyPastorSearchTermEdit, 'edit', 'deputyPastor');
      }
    }
  }

  selectPastor(pastor: Pastor, field: 'pastor' | 'deputyPastor' | 'editPastor' | 'editDeputyPastor' | 'addPastor' | 'addDeputyPastor'): void {
    if (!pastor) return;

    if (field.startsWith('edit')) {
      if (this.editingItem) {
        if (field === 'editPastor') {
          this.editingItem.pastor = pastor.name;
          this.pastorSearchTermEdit = pastor.name;
        } else {
          this.editingItem.deputyPastor = pastor.name;
          this.deputyPastorSearchTermEdit = pastor.name;
        }
      }
    } else if (field.startsWith('add')) {
      if (this.addingItem) {
        if (field === 'addPastor') {
          this.addingItem.pastor = pastor.name;
          this.pastorSearchTermCreate = pastor.name;
        } else {
          this.addingItem.deputyPastor = pastor.name;
          this.deputyPastorSearchTermCreate = pastor.name;
        }
      }
    } else {
      if (field === 'pastor') {
        this.newHiyawMahider.pastor = pastor.name;
        this.pastorSearchTermCreate = pastor.name;
      } else {
        this.newHiyawMahider.deputyPastor = pastor.name;
        this.deputyPastorSearchTermCreate = pastor.name;
      }
    }
  }

  getSafeDate(date: string | Date): Date | null {
    if (date instanceof Date) {
      return date;
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }

  loadPastors(): void {
    this.pastorService.getPastors().subscribe({
      next: (pastors) => {
        this.pastors = pastors;
        this.filteredPastorsCreate = this.getActivePastors();
        this.filteredDeputyPastorsCreate = this.getActivePastors();
        this.filteredPastorsEdit = this.getActivePastors();
        this.filteredDeputyPastorsEdit = this.getActivePastors();
      },
      error: (error) => {
        console.error('Error loading pastors:', error);
        this.errorMessage = 'Failed to load pastors. Please try again later.';
      }
    });
  }

  loadZones(): void {
    this.zoneService.getZones().subscribe({
      next: (zones) => {
        this.zones = zones;
      },
      error: (error) => {
        console.error('Error loading zones:', error);
        this.errorMessage = 'Failed to load zones. Please try again later.';
      }
    });
  }

  loadHiyawMahiders(): void {
    this.processingIds.clear();
    this.isLoading = true;
    this.errorMessage = null;

    this.hiyawMahiderService.searchHiyawMahiders({
      name: this.searchFilters.name,
      pastor: this.searchFilters.pastor,
      deputyPastor: this.searchFilters.deputyPastor,
      status: this.searchFilters.status || undefined,
      code: this.searchFilters.code,
      location: this.searchFilters.location,
      zone: this.searchFilters.zone || undefined
    }).pipe(
      tap((hiyawMahiders) => {
        this.dataSource.data = hiyawMahiders;
        if (this.paginator) {
          this.paginator.firstPage();
        }
        this.isLoading = false;
        this.initialLoadComplete = true;
      }),
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = error.message;
        this.dataSource.data = [];
        this.initialLoadComplete = true;
        return of([]);
      })
    ).subscribe();
  }

  // NOTE: Assigned members are now loaded lazily per Hiyaw Mahider

  filterPastors(searchTerm: string, formType: 'create' | 'edit', fieldType: 'pastor' | 'deputyPastor'): void {
    const activePastors = this.getActivePastors();

    if (!searchTerm) {
      if (formType === 'create') {
        if (fieldType === 'pastor') {
          this.filteredPastorsCreate = activePastors;
        } else {
          this.filteredDeputyPastorsCreate = activePastors;
        }
      } else {
        if (fieldType === 'pastor') {
          this.filteredPastorsEdit = activePastors;
        } else {
          this.filteredDeputyPastorsEdit = activePastors;
        }
      }
      return;
    }

    const filtered = activePastors.filter(pastor =>
      pastor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (formType === 'create') {
      if (fieldType === 'pastor') {
        this.filteredPastorsCreate = filtered;
      } else {
        this.filteredDeputyPastorsCreate = filtered;
      }
    } else {
      if (fieldType === 'pastor') {
        this.filteredPastorsEdit = filtered;
      } else {
        this.filteredDeputyPastorsEdit = filtered;
      }
    }
  }

  clearSearchTerms(): void {
    this.pastorSearchTermCreate = '';
    this.deputyPastorSearchTermCreate = '';
  }

  hasActiveFilters(): boolean {
    return Object.values(this.searchFilters).some(
      value => value !== undefined && value !== null && value !== ''
    );
  }

  // In hiyaw-mahider.component.ts - Updated loadMembers method
  loadMembers(): void {
    console.log('🔍 Loading members (sequential paged) ...');

    this.isLoadingMembers = true;
    this.errorMessage = null;
    this.members = [];
    this.filteredMembers = [];

    const pageSize = 100; // larger page for fewer requests
    const maxPages = 6;   // adjust if you expect more pages
    const pages = Array.from({ length: maxPages }, (_, i) => i + 1);
    const seen = new Set<string>();

    from(pages).pipe(
      concatMap(page =>
        this.memberService.getMembersPaged({
          status: 'active',
          includes: ['smallTeam'],
          page,
          pageSize
        }).pipe(
          catchError(error => {
            console.error(`❌ Page ${page} load failed:`, error);
            // Continue with other pages
            return of(null);
          })
        )
      ),
      reduce((acc, res) => {
        if (res?.data) {
          res.data.forEach(m => {
            if (!seen.has(m.id)) {
              seen.add(m.id);
              acc.push(m);
            }
          });
        }
        return acc;
      }, [] as Member[])
    ).subscribe({
      next: (combined) => {
        this.members = combined;
        this.filteredMembers = [...this.members];
        this.isLoadingMembers = false;

        console.log(`📊 RESULT: ${this.members.length} members loaded across up to ${maxPages} pages`);

        if (this.members.length === 0) {
          this.errorMessage = 'No members found in the system. Please check if members exist in the database.';
        }
      },
      error: (error) => {
        console.error('❌ Paged member loading FAILED:', error);
        this.isLoadingMembers = false;
        this.handleMemberLoadError(error);
      }
    });
  }

  private handleMemberLoadError(error: any): void {
    if (this.isCorsError(error)) {
      this.handleCorsError();
    } else if (error.status === 401 || error.status === 403) {
      this.errorMessage = 'Authentication failed. Please check if you are logged in and have proper permissions.';
      console.error('🔐 Auth error - user might not be authenticated');
    } else if (error.status === 404) {
      this.errorMessage = 'Members API endpoint not found. Please check the API URL configuration.';
    } else {
      this.errorMessage = `Failed to load members: ${error.message}`;
    }

    this.members = [];
    this.filteredMembers = [];
  }

  filterMembers(): void {
    console.log('🔍 Filtering members with term:', this.memberSearchTerm);

    const term = this.memberSearchTerm?.trim();

    // Debounce remote searches to reduce API spam
    if (this.memberSearchTimeout) {
      clearTimeout(this.memberSearchTimeout);
      this.memberSearchTimeout = null;
    }

    // No term: show cached list
    if (!term) {
      this.isSearchingMembers = false;
      this.filteredMembers = [...this.members];
      console.log('📋 Showing all members:', this.filteredMembers.length);
      return;
    }

    this.memberSearchTimeout = setTimeout(() => {
      // Always attempt a remote fuzzy search via API
      this.isSearchingMembers = true;
      this.memberService.getMembersPaged({
        status: 'active',
        includes: ['smallTeam'],
        search: term,
        page: 1,
        pageSize: 20
      }).subscribe({
        next: (response) => {
          const lower = term.toLowerCase();
          const remote = response.data || [];
          // Apply a local relevance filter on top of server results
          this.filteredMembers = this.filterLocallyFrom(remote, lower);
          this.isSearchingMembers = false;
          console.log('📋 Remote search returned (post-filter):', this.filteredMembers.length, 'members');
        },
        error: (error) => {
          console.error('❌ Remote member search failed:', error);
          this.isSearchingMembers = false;
          // Show empty results when remote search fails to avoid mixing unrelated cached data
          this.filteredMembers = [];
          this.errorMessage = 'Search failed (server error). Please try again.';
        }
      });
    }, 300); // 300ms debounce
  }

  // Local filter helper
  private filterLocally(searchTerm: string): Member[] {
    if (!this.members || this.members.length === 0) {
      return [];
    }

    return this.members.filter(member => {
      const matches = (
        (member.full_name && member.full_name.toLowerCase().includes(searchTerm)) ||
        (member.member_code && member.member_code.toLowerCase().includes(searchTerm)) ||
        (member.phone && member.phone.toLowerCase().includes(searchTerm)) ||
        (member.email && member.email.toLowerCase().includes(searchTerm)) ||
        (member.first_name && member.first_name.toLowerCase().includes(searchTerm)) ||
        (member.last_name && member.last_name.toLowerCase().includes(searchTerm))
      );
      return matches;
    });
  }

  // Local filter helper on provided list (for remote results)
  private filterLocallyFrom(list: Member[], searchTerm: string): Member[] {
    if (!list || list.length === 0) {
      return [];
    }

    return list.filter(member => {
      const matches = (
        (member.full_name && member.full_name.toLowerCase().includes(searchTerm)) ||
        (member.member_code && member.member_code.toLowerCase().includes(searchTerm)) ||
        (member.phone && member.phone.toLowerCase().includes(searchTerm)) ||
        (member.email && member.email.toLowerCase().includes(searchTerm)) ||
        (member.first_name && member.first_name.toLowerCase().includes(searchTerm)) ||
        (member.last_name && member.last_name.toLowerCase().includes(searchTerm))
      );
      return matches;
    });
  }

  // Enhanced member assignment with CORS fallback
  openMemberAssignment(hiyawMahider: HiyawMahider): void {
    if (this.corsWarning) {
      this.provideCorsSolutions();
      return;
    }

    this.selectedHiyawMahiderForAssignment = hiyawMahider;
    this.showMemberAssignment = true;
    this.memberSearchTerm = '';
    this.assignmentErrorMessage = null; // Clear any previous error

    // Set assignedMembers for dialog from the Map
    this.assignedMembers = this.assignedMembersMap.get(hiyawMahider.id) || [];

    // Load members for assignment
    this.loadMembers();
  }

  // In HiyawMahiderComponent - Update closeMemberAssignment method
  closeMemberAssignment(): void {
    this.showMemberAssignment = false;
    this.selectedHiyawMahiderForAssignment = null;
    this.memberSearchTerm = '';
    this.assignmentErrorMessage = null; // Clear the assignment error
    this.updatingRoles.clear();
  }

  // Update the loadAssignedMembers method for dialog refresh
  loadAssignedMembers(hiyawMahiderId: string): void {
    if (this.corsWarning) {
      console.warn('Skipping assigned members load due to CORS warning');
      return;
    }

    console.log(`🔍 Loading assigned members for Hiyaw Mahider: ${hiyawMahiderId}`);

    // Prefer local members list if already loaded
    if (this.members && this.members.length > 0) {
      const assigned = this.members.filter(m => m.hyaw_mahider_id === hiyawMahiderId);
      this.assignedMembersMap.set(hiyawMahiderId, assigned);
      this.assignedMembers = assigned;
      // Refresh table data to update counts
      this.dataSource.data = [...this.dataSource.data];
      console.log(`✅ Found ${this.assignedMembers.length} assigned members (from local cache)`);
      return;
    }

    // Fallback to API if local members are not available
    this.memberService.getMembers({
      includes: ['smallTeam'],
      hiyawMahiderId: hiyawMahiderId
    }).subscribe({
      next: (response) => {
        this.assignedMembersMap.set(hiyawMahiderId, response.data || []);
        this.assignedMembers = response.data || [];
        this.dataSource.data = [...this.dataSource.data];
        console.log(`✅ Found ${this.assignedMembers.length} assigned members (from API)`);
      },
      error: (error) => {
        console.error('❌ Error loading assigned members:', error);
        this.assignedMembersMap.set(hiyawMahiderId, []);
        this.assignedMembers = [];
      }
    });
  }

  // Update to use the Map
  getAssignedMembersCount(hiyawMahiderId: string): number {
    const members = this.assignedMembersMap.get(hiyawMahiderId);
    return members ? members.length : 0;
  }

  // CORS helper methods
  installCorsExtension(): void {
    const extensions = {
      chrome: 'https://chrome.google.com/webstore/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/',
      edge: 'https://microsoftedge.microsoft.com/addons/detail/cors-unblock/hkjklmhkbkdhlgnnfbbcihcajofmjgbh'
    };

    // Detect browser and open appropriate extension store
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) {
      window.open(extensions.chrome, '_blank');
    } else if (userAgent.includes('firefox')) {
      window.open(extensions.firefox, '_blank');
    } else if (userAgent.includes('edg')) {
      window.open(extensions.edge, '_blank');
    } else {
      window.open(extensions.chrome, '_blank'); // Default to Chrome
    }

    this.successMessage = 'Please install the CORS extension and refresh the page. Member assignment should work after installation.';
    setTimeout(() => this.successMessage = null, 8000);
  }

  dismissCorsWarning(): void {
    this.corsWarning = false;
    this.errorMessage = null;
    this.successMessage = 'CORS warning dismissed. Member features may not work until CORS is resolved.';
    setTimeout(() => this.successMessage = null, 5000);
  }

  setupProxyConfiguration(): void {
    this.successMessage = `
      To use proxy configuration:
      
      1. Create proxy.conf.json in your project root:
         {
           "/api": {
             "target": "https://backend.main.api.geuc.et",
             "secure": true,
             "changeOrigin": true,
             "pathRewrite": {
               "^/api": "/api/v1"
             }
           }
         }
      
      2. Update MemberService API URL to use '/api' in development
      
      3. Run: ng serve --proxy-config proxy.conf.json
    `;

    setTimeout(() => this.successMessage = null, 10000);
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.codeError = null;

    try {
      const codeExists = await this.hiyawMahiderService.isCodeExists(this.newHiyawMahider.code);
      if (codeExists) {
        this.codeError = 'This code is already in use';
        this.isLoading = false;
        return;
      }

      const exists = await this.hiyawMahiderService.isHiyawMahiderExists(
        this.newHiyawMahider.name,
        this.newHiyawMahider.location
      );

      if (exists) {
        this.errorMessage = 'A Hiyaw Mahider with this name and location already exists';
        this.isLoading = false;
        return;
      }

      const created = await this.hiyawMahiderService.createHiyawMahider({
        ...this.newHiyawMahider,
        code: this.newHiyawMahider.code.trim()
      });

      this.successMessage = `Hiyaw Mahider "${created.name}" created successfully with code "${created.code}"`;
      this.resetForm();
      this.loadHiyawMahiders();
      setTimeout(() => this.successMessage = null, 5000);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to create Hiyaw Mahider. Please try again.';
      console.error('Error creating Hiyaw Mahider:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.loadHiyawMahiders();
  }

  resetForm(): void {
    this.newHiyawMahider = this.getDefaultHiyawMahider();
    this.codeError = null;
    this.clearSearchTerms();
  }

  resetSearch(): void {
    this.searchFilters = {
      name: '',
      pastor: '',
      deputyPastor: '',
      status: '',
      code: '',
      location: '',
      zone: ''
    };
    this.loadHiyawMahiders();
  }

  private validateForm(): boolean {
    this.errorMessage = null;
    this.codeError = null;

    if (!this.newHiyawMahider.name?.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (!this.newHiyawMahider.HostName?.trim()) {
      this.errorMessage = 'Host Name is required';
      return false;
    }
    if (!this.newHiyawMahider.HostContactNumber?.trim()) {
      this.errorMessage = 'Host Contact Number is required';
      return false;
    }
    if (!this.newHiyawMahider.location?.trim()) {
      this.errorMessage = 'Location is required';
      return false;
    }
    if (!this.newHiyawMahider.code?.trim()) {
      this.codeError = 'Code is required';
      return false;
    }
    if (!/^[A-Za-z0-9\-_]+$/.test(this.newHiyawMahider.code)) {
      this.codeError = 'Code can only contain letters, numbers, hyphens, and underscores';
      return false;
    }

    return true;
  }

  private getDefaultHiyawMahider(): Omit<HiyawMahider, 'id' | 'createdDate'> {
    return {
      name: '',
      HostName: '',
      HostContactNumber: '',
      code: '',
      location: '',
      status: 'Active',
      pastor: null,
      zone: null,
      deputyPastor: null,
      studyDay: null,
      studyTime: null
    };
  }

  getZoneName(zoneId: string | null): string | null {
    if (!zoneId) return null;
    const zone = this.zones.find(z => z.id === zoneId);
    return zone ? zone.name : null;
  }

  onDelete(id: string, name: string): void {
    if (confirm(`Are you sure you want to delete the Hiyaw Mahider "${name}"?`)) {
      this.processingIds.add(id);
      this.hiyawMahiderService.deleteHiyawMahider(id).then(() => {
        this.successMessage = `Hiyaw Mahider "${name}" deleted successfully.`;
        this.loadHiyawMahiders();
        setTimeout(() => this.successMessage = null, 5000);
      }).catch(error => {
        this.errorMessage = `Failed to delete Hiyaw Mahider "${name}". Please try again.`;
        console.error('Error deleting Hiyaw Mahider:', error);
      }).finally(() => {
        this.processingIds.delete(id);
      });
    }
  }

  startEdit(hm: HiyawMahider): void {
    this.editingItem = { ...hm };
    this.isEditMode = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.pastorSearchTermEdit = this.editingItem.pastor || '';
    this.deputyPastorSearchTermEdit = this.editingItem.deputyPastor || '';
  }

  cancelEdit(): void {
    if (this.editingItem && this.editingItem.id) {
      this.processingIds.delete(this.editingItem.id);
    }
    this.isEditMode = false;
    this.editingItem = null;
    this.errorMessage = null;
    this.successMessage = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editingItem || !this.editingItem.id) return;

    if (!window.confirm(`Are you sure you want to update "${this.editingItem.name}"?`)) {
      return;
    }

    const itemId = this.editingItem.id;
    this.processingIds.add(itemId);
    this.isLoading = true;
    this.errorMessage = null;

    try {
      const updatedItem = await this.hiyawMahiderService.updateHiyawMahider(
        itemId,
        {
          name: this.editingItem.name,
          HostName: this.editingItem.HostName,
          HostContactNumber: this.editingItem.HostContactNumber,
          code: this.editingItem.code,
          location: this.editingItem.location,
          status: this.editingItem.status,
          pastor: this.editingItem.pastor,
          zone: this.editingItem.zone,
          deputyPastor: this.editingItem.deputyPastor,
          studyDay: this.editingItem.studyDay,
          studyTime: this.editingItem.studyTime
        }
      );

      this.auditLogService.log('HIYAW_MAHIDER_UPDATED', 'Hiyaw Mahider', itemId, updatedItem.name, updatedItem);
      this.successMessage = `Hiyaw Mahider "${updatedItem.name}" updated successfully`;
      this.isEditMode = false;
      this.editingItem = null;
      this.loadHiyawMahiders();
      setTimeout(() => this.successMessage = null, 5000);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to update Hiyaw Mahider';
      console.error('Error updating Hiyaw Mahider:', error);
    } finally {
      this.processingIds.delete(itemId);
      this.isLoading = false;
    }
  }

  // 🆕 NEW: Debug method to check current roles
  debugRoles(): void {
    console.log('🔍 DEBUG: Current roles in system');
    console.log('Available roles:', this.availableRoles);

    this.members.forEach((member, index) => {
      console.log(`Member ${index + 1}:`, {
        id: member.id,
        name: member.full_name,
        currentRole: member.role,
        hiyawMahider: member.hyaw_mahider_id
      });
    });

    // Check view assigned members
    if (this.viewAssignedMembers.length > 0) {
      console.log('🔍 View Assigned Members Roles:');
      this.viewAssignedMembers.forEach(member => {
        console.log(`- ${member.full_name}: ${member.role}`);
      });
    }
  }
}
