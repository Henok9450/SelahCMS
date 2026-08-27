import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
import { AttendanceService, SearchAttendanceResult, PaginatedAttendanceResponse } from '../core/services/attendance.service';
import { MemberService } from '../core/services/member.service';
import { HiyawMahiderService } from '../core/services/hiyaw-mahider.service';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, FormArray, Validators, FormControl, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { HiyawMahider } from '../core/models/hiyaw-mahider.model';
import { Member } from '../core/models/member.model';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { from, Observable, of } from 'rxjs';
import { map, catchError, switchMap, debounceTime, take, filter, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';

// Import AuthService
import { AuthService } from '../core/services/auth.service';


@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css'],
  providers: [DatePipe],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
  ]
})

export class AttendanceComponent implements OnInit, AfterViewInit {
  @ViewChild('memberSelectFilter') memberSelectFilter: ElementRef | undefined;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  attendanceForm: FormGroup;
  searchForm: FormGroup;
  hiyawMahiders: HiyawMahider[] = [];
  allMembers: Member[] = [];
  selectedDate: Date = new Date();
  selectedHiyawMahider: HiyawMahider | null = null;

  membersForSelectedHiyawMahider: Member[] = [];
  filteredSearchMembers: Observable<Member[]>;


  loading: boolean = false;
  searchLoading: boolean = false;

  dataSource = new MatTableDataSource<SearchAttendanceResult>([]);

  displayedColumns: string[] = ['date', 'hiyawMahider', 'studyDay', 'member', 'status', 'reason', 'actions'];

  existingAttendanceDocId: string | null = null;
  attendanceAlreadyTaken: boolean = false;

  memberFilterControl = new FormControl('');
  filteredMembersInAttendanceForm: Observable<any[]>;

  selectedStatus: string = '';
  statusOptions = [
    { value: 'present', label: 'Present', description: 'Member attended the session' },
    { value: 'absent', label: 'Absent', description: 'Member did not attend without notice' },
    { value: 'excused', label: 'Excused', description: 'Member informed the group ahead (travel, illness, etc.)' },
    { value: 'late', label: 'Late', description: 'Member joined after the session started' },
    { value: 'new-guest', label: 'New Guest', description: 'First-time visitor or guest' },
    { value: 'follow-up-needed', label: 'Follow-Up Needed', description: 'Absent or struggling members to check in with later' }
  ];


  isFormReadyForSubmit(): boolean {
    return this.attendanceForm.valid &&
      this.membersFormArray.length > 0 &&
      !this.loading;
  }

  totalResults: number = 0;
  pageSize: number = 5;
  pageIndex: number = 0;

  // Properties for user role and assigned Hiyaw Mahider, obtained from AuthService
  currentUserRole: string = '';
  currentUserAssignedHiyawMahiderId: string = '';

  constructor(
    private attendanceService: AttendanceService,
    private memberService: MemberService,
    private hiyawMahiderService: HiyawMahiderService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private authService: AuthService // Inject AuthService
  ) {
    this.attendanceForm = this.fb.group({
      hiyawMahiderId: ['', Validators.required],
      studyDay: [''],
      date: [new Date(), Validators.required],
      members: this.fb.array([], [Validators.required, this.validateMembersArray])
    });

    this.searchForm = this.fb.group({
      hiyawMahiderId: [''],
      memberId: [''],
      fromDate: [''],
      toDate: ['']
    });

    this.filteredMembersInAttendanceForm = this.memberFilterControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterMembers(value || ''))
    );

    this.filteredSearchMembers = this.searchForm.get('hiyawMahiderId')?.valueChanges.pipe(
      startWith(this.searchForm.get('hiyawMahiderId')?.value),
      map(hiyawMahiderId => {
        let membersToFilter = this.allMembers;

        // Apply role-based filtering for search members (if user is Pastor/Deputy Pastor)
        // This is primarily for the member select dropdown in the search form
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          membersToFilter = membersToFilter.filter(member => member.hyaw_mahider_id === this.currentUserAssignedHiyawMahiderId);
        }

        if (hiyawMahiderId) {
          return membersToFilter.filter(member => member.hyaw_mahider_id === hiyawMahiderId)
            .map(member => ({
              ...member,
              full_name: this.cleanMemberName(member.full_name)
            }));
        } else {
          return membersToFilter.map(member => ({
            ...member,
            full_name: this.cleanMemberName(member.full_name)
          }));
        }
      })
    ) || of([]);
  }

  private validateMemberGroup(group: FormGroup): ValidationErrors | null {
    const status = group.get('status')?.value;
    const reason = group.get('reason')?.value;

    // If status is not 'present', require a reason
    if (status !== 'present' && !reason) {
      return { reasonRequired: true };
    }

    return null;
  }


  ngOnInit(): void {
    console.log('🎯 [ATTENDANCE] Component initialized - Starting initialization...');

    // Subscribe to authService.authState$ to get the current user details
    this.authService.authState$.pipe(
      filter(user => user !== null), // Only proceed if a user is logged in
      take(1) // Take only the first emission to initialize once
    ).subscribe((user: any) => {
      console.log('👤 [ATTENDANCE] Auth state received:', {
        role: user?.role,
        hyaw_mahider_id: user?.hyaw_mahider_id,
        assignedHiyawMahider: user?.assignedHiyawMahider
      });

      if (user) {
        this.currentUserRole = user.role;
        // For Member model, use hyaw_mahider_id instead of assignedHiyawMahider
        this.currentUserAssignedHiyawMahiderId = user.hyaw_mahider_id || user.assignedHiyawMahider || ''; // Handle null case

        console.log('✅ [ATTENDANCE] User role and Hiyaw Mahider set:', {
          role: this.currentUserRole,
          assignedHiyawMahiderId: this.currentUserAssignedHiyawMahiderId
        });

        // If Pastor or Deputy Pastor, set and disable the Hiyaw Mahider fields
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          console.log('🔒 [ATTENDANCE] User is Pastor/Deputy Pastor - Pre-selecting Hiyaw Mahider:', this.currentUserAssignedHiyawMahiderId);

          this.attendanceForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId);
          this.attendanceForm.get('hiyawMahiderId')?.disable();
          this.searchForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId);
          this.searchForm.get('hiyawMahiderId')?.disable();

          // **New Logic for Pastor/Deputy Pastor:**
          // If a Hiyaw Mahider is pre-selected due to role, immediately trigger member loading
          // and check for existing attendance for the selected date.
          console.log('🔄 [ATTENDANCE] Triggering member loading for pre-selected Hiyaw Mahider...');
          this.onHiyawMahiderSelect(this.currentUserAssignedHiyawMahiderId);
        }
      }
      // Now that user info is loaded, proceed with loading Hiyaw Mahiders and members
      console.log('📋 [ATTENDANCE] Loading Hiyaw Mahiders, Members, and initial attendance search...');
      this.loadHiyawMahiders();
      this.loadAllMembers();
      this.searchAttendance();
    });

    this.attendanceForm.get('hiyawMahiderId')?.valueChanges.pipe(
      debounceTime(300),
      filter(hiyawMahiderId => !!hiyawMahiderId && !!this.attendanceForm.get('date')?.value),
      switchMap(hiyawMahiderId =>
        from(this.checkAndLoadExistingAttendance(hiyawMahiderId, this.attendanceForm.get('date')?.value))
      )
    ).subscribe();

    // **Modified:** Date change no longer automatically loads existing attendance
    // This prevents automatic switching to "edit mode" when selecting a date.
    // Duplicate validation still happens at submit time.
    this.attendanceForm.get('date')?.valueChanges.pipe(
      debounceTime(300),
      filter(date => !!date && !!this.attendanceForm.get('hiyawMahiderId')?.value)
    ).subscribe((date) => {
      console.log('📅 [ATTENDANCE] Date changed to:', date);
      // Clear any existing attendance state when date changes
      // This ensures user starts fresh when selecting a new date
      this.existingAttendanceDocId = null;
      this.attendanceAlreadyTaken = false;
      // Re-initialize form with default values (all present) for the new date
      if (this.membersForSelectedHiyawMahider.length > 0) {
        console.log('🔄 [ATTENDANCE] Re-initializing form for new date');
        this.initMemberControls();
      }
    });
  }

  ngAfterViewInit() {
    this.attendanceForm.valueChanges.subscribe(() => {
      // console.log('Form validity:', this.attendanceForm.valid);
      // console.log('Members count:', this.membersFormArray.length);
      // console.log('Form errors:', this.attendanceForm.errors);
      // this.membersFormArray.controls.forEach((control, i) => {
      //   console.log(`Member ${i} validity:`, control.valid);
      //   if (control.invalid) {
      //     console.log(`Member ${i} errors:`, control.errors);
      //     if (control instanceof FormGroup) {
      //       Object.keys(control.controls).forEach(key => {
      //         const innerControl = control.get(key);
      //         if (innerControl && innerControl.invalid && innerControl.touched) {
      //           console.log(`  Field ${key} errors:`, innerControl.errors);
      //         }
      //       });
      //     }
      //   }
      // });
    });
  }
  private cleanMemberName(name: string): string {
    if (!name) return '';
    return name.replace(/\s*\(.*?\)\s*/g, '').trim();
  }

  get dateControl(): FormControl {
    return this.attendanceForm.get('date') as FormControl;
  }

  loadHiyawMahiders(): void {
    console.log('📚 [ATTENDANCE] Loading Hiyaw Mahiders...');
    this.loading = true;
    this.hiyawMahiderService.getActiveHiyawMahiders().subscribe({
      next: (hiyawMahiders) => {
        console.log(`✅ [ATTENDANCE] Loaded ${hiyawMahiders.length} Hiyaw Mahiders from service`);

        // Filter based on the current user's role and assigned Hiyaw Mahider
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          const filtered = hiyawMahiders.filter(hm => hm.id === this.currentUserAssignedHiyawMahiderId);
          console.log(`🔍 [ATTENDANCE] Filtered to ${filtered.length} Hiyaw Mahider(s) for Pastor/Deputy Pastor role`);
          this.hiyawMahiders = filtered;
        } else {
          console.log(`📋 [ATTENDANCE] Showing all ${hiyawMahiders.length} Hiyaw Mahiders (Admin/Coordinator role)`);
          this.hiyawMahiders = hiyawMahiders;
        }
        this.loading = false;
        console.log('✅ [ATTENDANCE] Hiyaw Mahiders loading complete');
      },
      error: (err) => {
        console.error('❌ [ATTENDANCE] Failed to load Hiyaw Mahiders:', err);
        this.snackBar.open('Failed to load Hiyaw Mahiders', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    console.log('Selected status:', status);
  }

  loadAllMembers(): void {
    console.log('👥 [ATTENDANCE] Loading members from REST API...');
    console.log('📤 [ATTENDANCE] Request params:', {
      status: 'active',
      includes: ['smallTeam'],
      page: 1,
      pageSize: 500
    });

    this.loading = true;
    // Use MemberService to fetch members from REST API
    this.memberService.getMembersPaged({
      status: 'active',
      includes: ['smallTeam'],
      page: 1,
      pageSize: 500 // Fetch enough members for attendance
    }).subscribe({
      next: (response) => {
        const members = response.data || [];
        console.log(`✅ [ATTENDANCE] Loaded ${members.length} members from REST API`);
        console.log('📊 [ATTENDANCE] Response metadata:', response.meta);

        // Filter members based on the current user's role and assigned Hiyaw Mahider
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          const filtered = members.filter(member => member.hyaw_mahider_id === this.currentUserAssignedHiyawMahiderId);
          console.log(`🔍 [ATTENDANCE] Filtered to ${filtered.length} members for Hiyaw Mahider: ${this.currentUserAssignedHiyawMahiderId}`);
          this.allMembers = filtered;
        } else {
          console.log(`📋 [ATTENDANCE] Showing all ${members.length} members (Admin/Coordinator role)`);
          this.allMembers = members;
        }

        // Log sample member data for debugging
        if (this.allMembers.length > 0) {
          console.log('👤 [ATTENDANCE] Sample member data:', {
            id: this.allMembers[0].id,
            full_name: this.allMembers[0].full_name,
            hyaw_mahider_id: this.allMembers[0].hyaw_mahider_id,
            status: this.allMembers[0].status
          });
        }

        // Update validity to trigger filteredSearchMembers pipe, which depends on allMembers
        this.searchForm.get('hiyawMahiderId')?.updateValueAndValidity({ emitEvent: true });
        this.loading = false;
        console.log('✅ [ATTENDANCE] Members loading complete');

        // 🔄 If a Hiyaw Mahider is already selected, re-trigger member filtering
        const currentHiyawMahiderId = this.attendanceForm.get('hiyawMahiderId')?.value;
        if (currentHiyawMahiderId && this.allMembers.length > 0) {
          console.log('🔄 [ATTENDANCE] Re-triggering member filtering for pre-selected Hiyaw Mahider:', currentHiyawMahiderId);
          this.onHiyawMahiderSelect(currentHiyawMahiderId).catch(err => {
            console.error('❌ [ATTENDANCE] Error re-triggering member filtering:', err);
          });
        }
      },
      error: (err) => {
        console.error('❌ [ATTENDANCE] Failed to load members from REST API:', err);
        console.error('❌ [ATTENDANCE] Error details:', {
          message: err.message,
          status: err.status,
          url: err.url
        });
        this.snackBar.open('Failed to load all members', 'Close', { duration: 3000 });
        this.allMembers = [];
        this.loading = false;
      }
    });
  }

  // This method is now responsible for setting `membersForSelectedHiyawMahider`
  // and triggering `initMemberControls` and `checkAndLoadExistingAttendance`.
  async onHiyawMahiderSelect(hiyawMahiderId: string): Promise<void> {
    console.log(`🎯 [ATTENDANCE] Hiyaw Mahider selected: ${hiyawMahiderId}`);

    try {
      this.selectedHiyawMahider = this.hiyawMahiders.find(hm => hm.id === hiyawMahiderId) || null;

      if (!this.selectedHiyawMahider) {
        console.warn('⚠️ [ATTENDANCE] Hiyaw Mahider not found in list:', hiyawMahiderId);
        this.membersFormArray.clear();
        this.membersForSelectedHiyawMahider = []; // Clear if no Hiyaw Mahider selected
        return;
      }

      console.log('✅ [ATTENDANCE] Hiyaw Mahider found:', {
        id: this.selectedHiyawMahider.id,
        name: this.selectedHiyawMahider.name,
        studyDay: this.selectedHiyawMahider.studyDay
      });

      this.loading = true;

      this.attendanceForm.patchValue({
        hiyawMahiderId: this.selectedHiyawMahider.id,
        studyDay: this.selectedHiyawMahider.studyDay
      });

      // 🔒 VALIDATION: Ensure members are loaded before filtering
      if (this.allMembers.length === 0) {
        console.warn('⚠️ [ATTENDANCE] Members not loaded yet - loading members first...');
        await new Promise<void>((resolve) => {
          // Wait for members to load
          const checkMembers = () => {
            if (this.allMembers.length > 0) {
              console.log(`✅ [ATTENDANCE] Members loaded: ${this.allMembers.length} total members`);
              resolve();
            } else {
              // If still empty after a delay, try loading again
              setTimeout(() => {
                if (this.allMembers.length === 0) {
                  console.log('🔄 [ATTENDANCE] Reloading members...');
                  this.loadAllMembers();
                  // Wait a bit more for the async load
                  setTimeout(checkMembers, 1000);
                } else {
                  resolve();
                }
              }, 500);
            }
          };
          checkMembers();
        });
      }

      console.log(`🔍 [ATTENDANCE] Filtering ${this.allMembers.length} total members for Hiyaw Mahider: ${hiyawMahiderId}`);

      // Filter members for the selected Hiyaw Mahider
      let members = this.allMembers
        .filter(member => member.hyaw_mahider_id === hiyawMahiderId)
        .map(member => ({
          ...member,
          full_name: this.cleanMemberName(member.full_name || '')
        }));

      console.log(`📊 [ATTENDANCE] Found ${members.length} members assigned to this Hiyaw Mahider`);

      // This filter is already applied when loading allMembers if the user is Pastor/Deputy Pastor.
      // However, keeping it here as an extra layer of safety,
      // especially if this method is called independently with an ID that might not align
      // with the user's assigned HM (e.g., by an Admin temporarily changing HM in the form).
      if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
        const beforeFilter = members.length;
        members = members.filter(member => member.hyaw_mahider_id === this.currentUserAssignedHiyawMahiderId);
        console.log(`🔒 [ATTENDANCE] Role-based filter: ${beforeFilter} → ${members.length} members (Pastor/Deputy Pastor)`);
      }
      this.membersForSelectedHiyawMahider = members;

      if (members.length > 0) {
        console.log('👤 [ATTENDANCE] Sample members for this Hiyaw Mahider:', members.slice(0, 3).map(m => ({
          id: m.id,
          full_name: m.full_name,
          hyaw_mahider_id: m.hyaw_mahider_id
        })));
      } else {
        console.warn('⚠️ [ATTENDANCE] No members found for this Hiyaw Mahider. This might indicate:');
        console.warn('  - Members are not yet assigned to this Hiyaw Mahider');
        console.warn('  - Members are still loading from the API');
        console.warn('  - Filtering issue with hyaw_mahider_id');
      }

      // Call initMemberControls to populate the members list when a Hiyaw Mahider is selected.
      // **Modified:** No longer automatically checks for existing attendance on Hiyaw Mahider selection
      // This prevents automatic switching to "edit mode"
      // Duplicate validation still happens at submit time
      console.log('📝 [ATTENDANCE] Initializing member form controls...');
      this.initMemberControls();

      // Note: We don't automatically check for existing attendance here anymore
      // The duplicate check happens at submit time to prevent accidental edits
      console.log('ℹ️ [ATTENDANCE] Form initialized. Existing attendance will be checked at submit time.');
    } catch (error) {
      console.error('❌ [ATTENDANCE] Error in onHiyawMahiderSelect:', error);
      console.error('❌ [ATTENDANCE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.snackBar.open('Error loading attendance data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
      console.log('✅ [ATTENDANCE] Hiyaw Mahider selection complete');
    }
  }


  async checkMemberAttendance(memberId: string): Promise<void> {
    if (!this.attendanceForm.get('hiyawMahiderId')?.value || !this.attendanceForm.get('date')?.value) {
      return;
    }

    await this.checkAndLoadExistingAttendance(
      this.attendanceForm.get('hiyawMahiderId')?.value,
      this.attendanceForm.get('date')?.value,
      memberId
    );
  }

  // This method now solely focuses on handling the date change
  onDateChange(date: Date | null): void {
    if (!date) return;
    console.log('📅 [ATTENDANCE] Date changed via onDateChange:', date);
    this.selectedDate = date;
    this.attendanceForm.patchValue({ date: this.selectedDate }, { emitEvent: false });

    // **Modified:** No longer automatically loads existing attendance on date change
    // This prevents automatic switching to "edit mode"
    // User can manually load existing attendance if needed, or duplicate check happens at submit

    // Clear existing attendance state for the new date
    this.existingAttendanceDocId = null;
    this.attendanceAlreadyTaken = false;

    const hiyawMahiderId = this.attendanceForm.get('hiyawMahiderId')?.value;
    if (hiyawMahiderId) {
      // Only re-initialize member controls if members are already loaded
      // Don't trigger full onHiyawMahiderSelect which would check for existing attendance
      if (this.membersForSelectedHiyawMahider.length > 0) {
        console.log('🔄 [ATTENDANCE] Re-initializing form controls for new date');
        this.initMemberControls();
      }
    } else {
      // If no Hiyaw Mahider is selected (e.g., for Admin before selection), clear members
      this.membersForSelectedHiyawMahider = [];
      this.membersFormArray.clear();
      this.attendanceAlreadyTaken = false;
      this.existingAttendanceDocId = null;
    }
  }

  onStatusChange(index: number): void {
    const memberControl = this.membersFormArray.at(index);
    const status = memberControl.get('status')?.value;

    if (status === 'present') {
      memberControl.get('reason')?.setValue('');
    }
  }

  async checkAndLoadExistingAttendance(hiyawMahiderId: string, date: Date, memberId?: string): Promise<void> {
    console.log(`🔍 [ATTENDANCE] Checking existing attendance for:`, {
      hiyawMahiderId,
      date: date.toISOString().split('T')[0],
      memberId: memberId || 'all members'
    });

    if (!hiyawMahiderId || !date) {
      console.warn('⚠️ [ATTENDANCE] Missing required params - skipping attendance check');
      this.attendanceAlreadyTaken = false;
      this.existingAttendanceDocId = null;
      this.initMemberControls(); // Re-initialize to show all current members as 'present'
      return;
    }

    this.loading = true;
    try {
      const existingRecord = await this.attendanceService.getAttendanceForHiyawMahiderAndDate(hiyawMahiderId, date);

      if (existingRecord) {
        console.log('✅ [ATTENDANCE] Existing attendance record found:', {
          docId: existingRecord.id,
          memberCount: existingRecord.members?.length || 0,
          date: existingRecord.date
        });
        this.existingAttendanceDocId = existingRecord.id;
        this.attendanceAlreadyTaken = true;
        console.log('📝 [ATTENDANCE] Prefilling form with existing attendance data...');
        this.prefillMemberControls(existingRecord.members);
      } else {
        console.log('ℹ️ [ATTENDANCE] No existing attendance record found - initializing new form');
        this.existingAttendanceDocId = null;
        this.attendanceAlreadyTaken = false;
        this.initMemberControls(); // Initialize with all members marked 'present' if no record
      }
    } catch (err) {
      console.error('❌ [ATTENDANCE] Error checking existing attendance:', err);
      console.error('❌ [ATTENDANCE] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        hiyawMahiderId,
        date: date.toISOString()
      });
      this.snackBar.open('Error checking existing attendance', 'Close', { duration: 3000 });
      this.existingAttendanceDocId = null;
      this.attendanceAlreadyTaken = false;
      this.initMemberControls(); // Fallback: Initialize with all members if error
    } finally {
      this.loading = false;
      console.log('✅ [ATTENDANCE] Attendance check complete');
    }
  }

  /**
   * Initializes form controls for members.
   * Maps 'id' to 'userId' and uses 'full_name'.
   */
  initMemberControls(): void {
    console.log(`📝 [ATTENDANCE] Initializing form controls for ${this.membersForSelectedHiyawMahider.length} members`);

    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    // Ensure only members for the *selected* Hiyaw Mahider are added
    this.membersForSelectedHiyawMahider.forEach((member, index) => {
      const memberGroup = this.fb.group({
        userId: [member.id || '', Validators.required], // Use member.id as userId
        fullName: [this.cleanMemberName(member.full_name || ''), Validators.required],
        status: ['present', Validators.required], // Default to 'present'
        reason: ['']
      }, { validators: this.validateMemberGroup });

      memberFormArray.push(memberGroup);

      if (index < 3) { // Log first 3 members for debugging
        console.log(`  ✅ [ATTENDANCE] Added member ${index + 1}:`, {
          userId: member.id,
          fullName: member.full_name,
          defaultStatus: 'present'
        });
      }
    });

    this.attendanceForm.updateValueAndValidity();
    console.log(`✅ [ATTENDANCE] Form controls initialized: ${memberFormArray.length} members, form valid: ${this.attendanceForm.valid}`);
  }


  /**
   * Prefills form controls with existing attendance data.
   * Uses member.id instead of member.uid.
   */
  prefillMemberControls(existingMembersData: any[]): void {
    console.log(`📝 [ATTENDANCE] Prefilling form controls with ${existingMembersData.length} existing attendance records`);
    console.log('📋 [ATTENDANCE] Existing members data:', existingMembersData.slice(0, 3).map(m => ({
      userId: m.userId,
      fullName: m.fullName,
      status: m.status
    })));

    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    let prefilledCount = 0;
    let defaultCount = 0;

    // Start with all members for the selected Hiyaw Mahider
    this.membersForSelectedHiyawMahider.forEach((member, index) => {
      const existingMemberRecord = existingMembersData.find((m: { userId: any; }) => m.userId === member.id);

      if (existingMemberRecord) {
        prefilledCount++;
        if (index < 3) {
          console.log(`  ✅ [ATTENDANCE] Prefilled member ${index + 1}:`, {
            userId: member.id,
            fullName: member.full_name,
            status: existingMemberRecord.status,
            reason: existingMemberRecord.reason || 'none'
          });
        }
      } else {
        defaultCount++;
      }

      memberFormArray.push(this.fb.group({
        userId: [member.id, Validators.required],
        fullName: [member.full_name],
        status: [existingMemberRecord ? existingMemberRecord.status : 'present', Validators.required], // Prefill if found, else default
        reason: [existingMemberRecord ? existingMemberRecord.reason : '']
      }));
    });

    console.log(`✅ [ATTENDANCE] Prefill complete: ${prefilledCount} with existing data, ${defaultCount} with defaults`);
    console.log(`📊 [ATTENDANCE] Total form controls: ${memberFormArray.length}`);

    // Optionally, if existingMembersData contains members not in `membersForSelectedHiyawMahider`
    // (e.g., if a member was reassigned or deleted but their attendance remains),
    // you might want to add them as well, perhaps with a visual indicator.
    // For now, we assume `membersForSelectedHiyawMahider` is the definitive list.
  }

  private _filterMembers(value: string): Member[] {
    const filterValue = value.toLowerCase();
    // Use membersForSelectedHiyawMahider for filtering in the attendance form,
    // which is already filtered by role and Hiyaw Mahider.
    return this.membersForSelectedHiyawMahider
      .map(member => ({
        ...member,
        full_name: this.cleanMemberName(member.full_name)
      }))
      .filter(member =>
        member.full_name.toLowerCase().includes(filterValue)
      );
  }

  scrollToMember(memberId: string): void {
    const memberRow = document.getElementById(`member-row-${memberId}`);
    if (memberRow) {
      memberRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      memberRow.classList.add('highlight');
      setTimeout(() => {
        memberRow.classList.remove('highlight');
      }, 1500);
    }
    this.memberFilterControl.setValue('');
  }
  async searchAttendance(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): Promise<void> {
    console.log('🔍 [ATTENDANCE] Searching attendance records...', {
      pageIndex,
      pageSize,
      formValues: this.searchForm.value
    });

    this.searchLoading = true;
    const searchParams = {
      hiyawMahiderId: this.searchForm.value.hiyawMahiderId,
      memberId: this.searchForm.value.memberId,
      fromDate: this.searchForm.value.fromDate,
      toDate: this.searchForm.value.toDate
    };

    // If Pastor or Deputy Pastor, enforce search on their assigned Hiyaw Mahider
    // This ensures initial load and any subsequent searches respect the role
    if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
      console.log('🔒 [ATTENDANCE] Enforcing Hiyaw Mahider filter for Pastor/Deputy Pastor:', this.currentUserAssignedHiyawMahiderId);
      searchParams.hiyawMahiderId = this.currentUserAssignedHiyawMahiderId;
      // Ensure the form control also reflects this enforced value if not already set
      if (this.searchForm.get('hiyawMahiderId')?.value !== this.currentUserAssignedHiyawMahiderId) {
        this.searchForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId, { emitEvent: false });
      }
    }

    console.log('📤 [ATTENDANCE] Search parameters:', searchParams);

    try {
      const response: PaginatedAttendanceResponse = await this.attendanceService.searchAttendance(
        searchParams,
        pageIndex,
        pageSize
      );

      console.log(`✅ [ATTENDANCE] Search completed: ${response.totalCount} total records, showing ${response.results.length} on page ${pageIndex + 1}`);

      // Clean member names in the response
      response.results = response.results.map(result => ({
        ...result,
        memberName: this.cleanMemberName(result.memberName)
      }));

      if (response.results.length > 0) {
        console.log('📋 [ATTENDANCE] Sample search results:', response.results.slice(0, 3).map(r => ({
          date: r.date,
          memberName: r.memberName,
          status: r.status,
          hiyawMahiderName: r.hiyawMahiderName
        })));
      }

      this.dataSource.data = response.results;
      this.totalResults = response.totalCount;
      console.log('✅ [ATTENDANCE] Search results loaded into table');
    } catch (err) {
      console.error('❌ [ATTENDANCE] Failed to search attendance:', err);
      console.error('❌ [ATTENDANCE] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        searchParams
      });
      this.snackBar.open('Failed to search attendance', 'Close', { duration: 3000 });
      this.dataSource.data = [];
      this.totalResults = 0;
    } finally {
      this.searchLoading = false;
      console.log('✅ [ATTENDANCE] Search operation complete');
    }
  }



  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.searchAttendance();
  }
  clearSearch(): void {
    this.searchForm.reset();
    this.searchForm.get('memberId')?.setValue('');
    this.pageIndex = 0;
    this.pageSize = 10;
    // If Pastor or Deputy Pastor, re-set the hiyawMahiderId after reset
    if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
      this.searchForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId, { emitEvent: false }); // Prevent infinite loop
    }
    this.searchAttendance(); // Trigger a new search with the correct defaults
  }
  private markAllAsTouched(): void {
    this.attendanceForm.markAllAsTouched();
    this.membersFormArray.controls.forEach(group => {
      if (group instanceof FormGroup) {
        Object.values(group.controls).forEach(control => {
          control.markAsTouched();
        });
      }
    });
  }

  async submitAttendance(): Promise<void> {
    console.log('📤 [ATTENDANCE] Submit attendance triggered');

    if (!this.selectedHiyawMahider) {
      console.warn('⚠️ [ATTENDANCE] No Hiyaw Mahider selected');
      this.snackBar.open('Please select a Hiyaw Mahider', 'Close', { duration: 3000 });
      return;
    }

    if (this.attendanceForm.invalid) {
      console.warn('⚠️ [ATTENDANCE] Form validation failed');
      console.log('📋 [ATTENDANCE] Form errors:', this.attendanceForm.errors);
      console.log('📋 [ATTENDANCE] Members array length:', this.membersFormArray.length);

      this.markAllAsTouched();

      // Show specific error messages
      if (this.membersFormArray.length === 0) {
        console.warn('⚠️ [ATTENDANCE] No members in form array');
        this.snackBar.open('Please add at least one member', 'Close', { duration: 3000 });
      } else {
        console.warn('⚠️ [ATTENDANCE] Form has validation errors');
        this.snackBar.open('Please fill all required fields correctly', 'Close', { duration: 3000 });
      }
      return;
    }

    console.log('✅ [ATTENDANCE] Form validation passed');
    this.loading = true;

    try {
      const currentDate = this.attendanceForm.get('date')?.value;

      // 🔒 VALIDATION: Check for duplicate attendance before creating new record
      if (!this.existingAttendanceDocId) {
        console.log('🔍 [ATTENDANCE] Checking for duplicate attendance before creation...');
        const existingRecord = await this.attendanceService.getAttendanceForHiyawMahiderAndDate(
          this.selectedHiyawMahider.id,
          currentDate
        );

        if (existingRecord) {
          console.warn('⚠️ [ATTENDANCE] Duplicate attendance detected!', {
            existingDocId: existingRecord.id,
            hiyawMahiderId: this.selectedHiyawMahider.id,
            date: currentDate.toISOString().split('T')[0],
            memberCount: existingRecord.members?.length || 0
          });

          this.loading = false;
          this.existingAttendanceDocId = existingRecord.id;
          this.attendanceAlreadyTaken = true;

          // Prefill the form with existing data
          this.prefillMemberControls(existingRecord.members);

          this.snackBar.open(
            `Attendance for ${this.selectedHiyawMahider.name} on ${this.datePipe.transform(currentDate, 'mediumDate')} already exists. Please update the existing record instead.`,
            'Close',
            { duration: 7000 }
          );

          console.log('🔄 [ATTENDANCE] Form prefilled with existing attendance data');
          return;
        }
        console.log('✅ [ATTENDANCE] No duplicate found - proceeding with creation');
      }

      const membersToSubmit = this.attendanceForm.value.members.map((m: any) => ({
        ...m,
        fullName: this.cleanMemberName(m.fullName || '') // fullName is already set in form control
      }));

      console.log('📊 [ATTENDANCE] Preparing attendance data:', {
        hiyawMahiderId: this.selectedHiyawMahider.id,
        hiyawMahiderName: this.selectedHiyawMahider.name,
        studyDay: this.selectedHiyawMahider.studyDay,
        date: currentDate,
        memberCount: membersToSubmit.length,
        isUpdate: !!this.existingAttendanceDocId
      });

      console.log('👥 [ATTENDANCE] Members to submit:', membersToSubmit.slice(0, 3).map((m: any) => ({
        userId: m.userId,
        fullName: m.fullName,
        status: m.status
      })));

      const attendanceData = {
        hiyawMahiderId: this.selectedHiyawMahider.id,
        hiyawMahiderName: this.selectedHiyawMahider.name,
        studyDay: this.selectedHiyawMahider.studyDay || '',
        date: currentDate,
        members: membersToSubmit
      };

      if (this.existingAttendanceDocId) {
        console.log(`🔄 [ATTENDANCE] Updating existing attendance record: ${this.existingAttendanceDocId}`);
        await this.attendanceService.updateAttendanceMembers(
          this.existingAttendanceDocId,
          membersToSubmit
        );
        console.log('✅ [ATTENDANCE] Attendance updated successfully');
        this.snackBar.open('Attendance updated successfully', 'Close', { duration: 3000 });
        this.resetFormAfterUpdate();
        this.searchAttendance();
      } else {
        console.log('➕ [ATTENDANCE] Creating new attendance record');
        const docId = await this.attendanceService.createAttendance(attendanceData);
        console.log('✅ [ATTENDANCE] Attendance created successfully with ID:', docId);
        this.snackBar.open('Attendance recorded successfully', 'Close', { duration: 3000 });
        this.clearAttendanceForm();
        this.searchAttendance();
      }
    } catch (error) {
      console.error('❌ [ATTENDANCE] Error submitting attendance:', error);
      console.error('❌ [ATTENDANCE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        selectedHiyawMahider: this.selectedHiyawMahider?.id
      });
      this.snackBar.open('Failed to record attendance', 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
      console.log('✅ [ATTENDANCE] Submit attendance complete');
    }
  }


  resetFormAfterUpdate(): void {
    // Only clear hiyawMahiderId if the user is not Pastor/Deputy Pastor
    if (!['Pastor', 'Deputy Pastor'].includes(this.currentUserRole)) {
      this.attendanceForm.get('hiyawMahiderId')?.setValue('');
    } else {
      // Re-trigger onHiyawMahiderSelect for Pastor/Deputy to re-load members for the existing HM
      this.onHiyawMahiderSelect(this.currentUserAssignedHiyawMahiderId);
    }
    this.selectedHiyawMahider = null; // This will be set again by onHiyawMahiderSelect if applicable

    const membersArray = this.membersFormArray;
    membersArray.clear();

    this.existingAttendanceDocId = null;
    this.attendanceAlreadyTaken = false;
    // Don't clear membersForSelectedHiyawMahider here, as it's needed for initMemberControls
    // this.membersForSelectedHiyawMahider = [];

    this.selectedDate = new Date();
    this.attendanceForm.get('date')?.setValue(this.selectedDate);

    this.memberFilterControl.setValue('');
  }

  clearAttendanceForm(): void {
    this.dateControl.setValue(new Date());
    this.selectedDate = new Date();
    // Only clear hiyawMahiderId if the user is not Pastor/Deputy Pastor
    if (!['Pastor', 'Deputy Pastor'].includes(this.currentUserRole)) {
      this.attendanceForm.get('hiyawMahiderId')?.setValue('');
    } else {
      // For Pastor/Deputy, after clearing the form, reload members for the pre-selected HM
      this.onHiyawMahiderSelect(this.currentUserAssignedHiyawMahiderId);
    }
    this.selectedHiyawMahider = null; // This will be set again by onHiyawMahiderSelect if applicable
    (this.attendanceForm.get('members') as FormArray).clear();
    this.existingAttendanceDocId = null;
    this.attendanceAlreadyTaken = false;
    this.memberFilterControl.setValue('');
  }

  async editAttendance(record: SearchAttendanceResult): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: `Current status for ${record.memberName} on ${this.datePipe.transform(record.date, 'mediumDate')}: ${this.statusOptions.find(opt => opt.value === record.status)?.label || record.status}. \n\nDo you want to edit this record?`,
        title: 'Edit Attendance Record',
        buttonText: {
          ok: 'Proceed to Edit',
          cancel: 'Cancel'
        }
      }
    });

    dialogRef.afterClosed().subscribe(async (proceed: boolean) => {
      if (!proceed) {
        return;
      }

      const statusOptionsText = this.statusOptions.map(opt => `${opt.label} (${opt.value})`).join(', ');
      const newStatusPrompt = prompt(`Enter new status for ${record.memberName} (e.g., ${statusOptionsText}):`, record.status);

      if (newStatusPrompt === null || newStatusPrompt.trim() === '') {
        this.snackBar.open('Status update cancelled or empty.', 'Close', { duration: 2000 });
        return;
      }

      const normalizedNewStatus = newStatusPrompt.trim().toLowerCase();
      const statusObj = this.statusOptions.find(opt =>
        opt.label.toLowerCase() === normalizedNewStatus || opt.value === normalizedNewStatus
      );

      if (!statusObj) {
        this.snackBar.open('Invalid status entered. Please use one of the suggested options.', 'Close', { duration: 7000 });
        return;
      }

      let newReason = record.reason || '';
      if (statusObj.value !== 'present') {
        const reasonPromptResult = prompt(`Enter reason/notes for ${record.memberName} (Current: ${record.reason || '-'}):`, record.reason || '');
        if (reasonPromptResult !== null) {
          newReason = reasonPromptResult.trim();
        } else {
          newReason = record.reason || '';
        }
      } else {
        newReason = '';
      }

      try {
        this.loading = true;
        await this.attendanceService.updateMemberAttendanceStatus(
          record.id,
          record.memberId,
          statusObj.value,
          newReason
        );
        this.snackBar.open('Attendance record updated successfully', 'Close', { duration: 3000 });
        this.searchAttendance(); // Refresh search results after update
      } catch (error) {
        console.error('Error updating individual attendance record:', error);
        this.snackBar.open('Failed to update attendance record', 'Close', { duration: 3000 });
      } finally {
        this.loading = false;
      }
    });
  }

  async deleteAttendance(record: SearchAttendanceResult): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: `Are you sure you want to delete the attendance record for ${record.memberName} on ${this.datePipe.transform(record.date, 'mediumDate')}? This will remove the individual's record from this day's attendance.`,
        buttonText: {
          ok: 'Delete',
          cancel: 'Cancel'
        }
      }
    });

    dialogRef.afterClosed().subscribe(async (confirmed: boolean) => {
      if (confirmed) {
        try {
          this.loading = true;
          await this.attendanceService.deleteMemberAttendanceRecord(record.id, record.memberId);
          this.snackBar.open('Attendance record deleted successfully', 'Close', { duration: 3000 });
          this.searchAttendance(); // Refresh search results after deletion
        } catch (error) {
          console.error('Error deleting attendance record:', error);
          this.snackBar.open('Failed to delete attendance record', 'Close', { duration: 3000 });
        } finally {
          this.loading = false;
        }
      }
    });
  }

  get membersFormArray(): FormArray {
    return this.attendanceForm.get('members') as FormArray;
  }

  get hiyawMahiderIdControl(): FormControl {
    return this.attendanceForm.get('hiyawMahiderId') as FormControl;
  }

  getStatusDescription(status: string): string {
    const option = this.statusOptions.find(opt => opt.value === status);
    return option ? option.description : '';
  }
  private validateMembersArray(control: AbstractControl): ValidationErrors | null {
    const membersArray = control as FormArray;

    if (membersArray.length === 0) {
      return { noMembers: true };
    }

    // Check if any member is invalid
    const invalidMembers = membersArray.controls.filter((c: AbstractControl) => c.invalid);
    if (invalidMembers.length > 0) {
      return { invalidMembers: true };
    }

    return null;
  }

  getStudyDay(hiyawMahiderId: string | null | undefined): string {
    if (!hiyawMahiderId) return '-';
    const hm = this.hiyawMahiders.find(h => h.id === hiyawMahiderId);
    return hm && hm.studyDay ? hm.studyDay : '-';
  }
}
