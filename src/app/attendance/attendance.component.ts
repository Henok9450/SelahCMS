import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
import { AttendanceService, SearchAttendanceResult, PaginatedAttendanceResponse } from '../core/attendance.service';
import { UserService } from '../core/user.service';
import { HiyawMahiderService } from '../core/hiyaw-mahider.service';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, FormArray, Validators, FormControl, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { HiyawMahider } from '../core/hiyaw-mahider.model';
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

// Import AuthService and User model
import { AuthService } from '../core/auth.service';
import { User } from '../core/user.model';


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
    ConfirmDialogComponent
  ]
})
export class AttendanceComponent implements OnInit, AfterViewInit {
  @ViewChild('memberSelectFilter') memberSelectFilter: ElementRef | undefined;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  attendanceForm: FormGroup;
  searchForm: FormGroup;
  hiyawMahiders: HiyawMahider[] = [];
  allMembers: any[] = [];
  selectedDate: Date = new Date();
  selectedHiyawMahider: HiyawMahider | null = null;

  membersForSelectedHiyawMahider: any[] = [];
  filteredSearchMembers: Observable<any[]>;


  loading: boolean = false;
  searchLoading: boolean = false;

  dataSource = new MatTableDataSource<SearchAttendanceResult>([]);

  displayedColumns: string[] = ['date', 'hiyawMahider', 'member', 'status', 'reason', 'actions'];

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
    private userService: UserService, // Keep if still directly needed for other user-related tasks
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
            membersToFilter = membersToFilter.filter(member => member.assignedHiyawMahider === this.currentUserAssignedHiyawMahiderId);
        }

        if (hiyawMahiderId) {
          return membersToFilter.filter(member => member.assignedHiyawMahider === hiyawMahiderId)
            .map(member => ({
              ...member,
              fullName: this.cleanMemberName(member.fullName)
            }));
        } else {
          return membersToFilter.map(member => ({
            ...member,
            fullName: this.cleanMemberName(member.fullName)
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
    // Subscribe to authService.authState$ to get the current user details
    this.authService.authState$.pipe(
      filter(user => user !== null), // Only proceed if a user is logged in
      take(1) // Take only the first emission to initialize once
    ).subscribe((user: User | null) => {
      if (user) {
        this.currentUserRole = user.role;
        this.currentUserAssignedHiyawMahiderId = user.assignedHiyawMahider || ''; // Handle null case

        // If Pastor or Deputy Pastor, set and disable the Hiyaw Mahider fields
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          this.attendanceForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId);
          this.attendanceForm.get('hiyawMahiderId')?.disable();
          this.searchForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId);
          this.searchForm.get('hiyawMahiderId')?.disable();

          // **New Logic for Pastor/Deputy Pastor:**
          // If a Hiyaw Mahider is pre-selected due to role, immediately trigger member loading
          // and check for existing attendance for the selected date.
          this.onHiyawMahiderSelect(this.currentUserAssignedHiyawMahiderId);
        }
      }
      // Now that user info is loaded, proceed with loading Hiyaw Mahiders and members
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

    // **Important Change Here:**
    // When date changes, we need to re-trigger the member loading and existing attendance check.
    // This is especially crucial for Pastor/Deputy Pastor roles where Hiyaw Mahider is pre-set.
    this.attendanceForm.get('date')?.valueChanges.pipe(
      debounceTime(300),
      filter(date => !!date && !!this.attendanceForm.get('hiyawMahiderId')?.value),
      switchMap(date => {
        const hiyawMahiderId = this.attendanceForm.get('hiyawMahiderId')?.value;
        return from(this.checkAndLoadExistingAttendance(hiyawMahiderId, date));
      })
    ).subscribe();
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
    this.loading = true;
    this.hiyawMahiderService.getActiveHiyawMahiders().subscribe({
      next: (hiyawMahiders) => {
        // Filter based on the current user's role and assigned Hiyaw Mahider
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          this.hiyawMahiders = hiyawMahiders.filter(hm => hm.id === this.currentUserAssignedHiyawMahiderId);
        } else {
          this.hiyawMahiders = hiyawMahiders;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load Hiyaw Mahiders:', err);
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
    this.userService.getUsersWithDetails().subscribe({
      next: (users) => {
        // Filter members based on the current user's role and assigned Hiyaw Mahider
        if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
          this.allMembers = users.filter(user => user.assignedHiyawMahider === this.currentUserAssignedHiyawMahiderId);
        } else {
          this.allMembers = users;
        }
        // Update validity to trigger filteredSearchMembers pipe, which depends on allMembers
        this.searchForm.get('hiyawMahiderId')?.updateValueAndValidity({ emitEvent: true });

        // If a hiyawMahiderId is already set in the form (e.g., for Pastor/Deputy Pastor),
        // call onHiyawMahiderSelect to populate members.
        // This is now handled more robustly in ngOnInit after authState$ subscription.
        // if (this.attendanceForm.get('hiyawMahiderId')?.value) {
        //   this.onHiyawMahiderSelect(this.attendanceForm.get('hiyawMahiderId')?.value);
        // }
      },
      error: (err) => {
        console.error('Failed to load all members:', err);
        this.snackBar.open('Failed to load all members', 'Close', { duration: 3000 });
      }
    });
  }

  // This method is now responsible for setting `membersForSelectedHiyawMahider`
  // and triggering `initMemberControls` and `checkAndLoadExistingAttendance`.
  async onHiyawMahiderSelect(hiyawMahiderId: string): Promise<void> {
    try {
      this.selectedHiyawMahider = this.hiyawMahiders.find(hm => hm.id === hiyawMahiderId) || null;

      if (!this.selectedHiyawMahider) {
        this.membersFormArray.clear();
        this.membersForSelectedHiyawMahider = []; // Clear if no Hiyaw Mahider selected
        return;
      }

      this.loading = true;

      this.attendanceForm.patchValue({
        hiyawMahiderId: this.selectedHiyawMahider.id,
        studyDay: this.selectedHiyawMahider.studyDay
      });

      // Filter members for the selected Hiyaw Mahider
      let members = this.allMembers
        .filter(user => user.assignedHiyawMahider === hiyawMahiderId)
        .map(member => ({
          ...member,
          fullName: this.cleanMemberName(member.fullName || '')
        }));

      // This filter is already applied when loading allMembers if the user is Pastor/Deputy Pastor.
      // However, keeping it here as an extra layer of safety,
      // especially if this method is called independently with an ID that might not align
      // with the user's assigned HM (e.g., by an Admin temporarily changing HM in the form).
      if (['Pastor', 'Deputy Pastor'].includes(this.currentUserRole) && this.currentUserAssignedHiyawMahiderId) {
        members = members.filter(member => member.assignedHiyawMahider === this.currentUserAssignedHiyawMahiderId);
      }
      this.membersForSelectedHiyawMahider = members;


      // Call initMemberControls and checkAndLoadExistingAttendance here
      // to populate the members list when a Hiyaw Mahider is selected.
      this.initMemberControls();
      await this.checkAndLoadExistingAttendance(hiyawMahiderId, this.selectedDate);
    } catch (error) {
      console.error('Error in onHiyawMahiderSelect:', error);
      this.snackBar.open('Error loading attendance data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
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
    this.selectedDate = date;
    this.attendanceForm.patchValue({ date: this.selectedDate }, { emitEvent: false });

    // **Refined Logic:** If Hiyaw Mahider is already set (which it will be for Pastor/Deputy),
    // we need to call onHiyawMahiderSelect to re-evaluate members and check existing attendance.
    const hiyawMahiderId = this.attendanceForm.get('hiyawMahiderId')?.value;
    if (hiyawMahiderId) {
      // Re-trigger onHiyawMahiderSelect which handles loading members and checking attendance
      this.onHiyawMahiderSelect(hiyawMahiderId)
        .then(() => this.loading = false)
        .catch(() => this.loading = false);
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
    if (!hiyawMahiderId || !date) {
      this.attendanceAlreadyTaken = false;
      this.existingAttendanceDocId = null;
      this.initMemberControls(); // Re-initialize to show all current members as 'present'
      return;
    }

    this.loading = true;
    try {
      const existingRecord = await this.attendanceService.getAttendanceForHiyawMahiderAndDate(hiyawMahiderId, date);

      if (existingRecord) {
        this.existingAttendanceDocId = existingRecord.id;
        this.attendanceAlreadyTaken = true;
        this.prefillMemberControls(existingRecord.members);
      } else {
        this.existingAttendanceDocId = null;
        this.attendanceAlreadyTaken = false;
        this.initMemberControls(); // Initialize with all members marked 'present' if no record
      }
    } catch (err) {
      console.error('Error checking existing attendance:', err);
      this.snackBar.open('Error checking existing attendance', 'Close', { duration: 3000 });
      this.existingAttendanceDocId = null;
      this.attendanceAlreadyTaken = false;
      this.initMemberControls(); // Fallback: Initialize with all members if error
    } finally {
      this.loading = false;
    }
  }

  /**
   * Initializes form controls for members.
   * Maps 'uid' to 'userId' and uses 'fullName'.
   */
  initMemberControls(): void {
    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    // Ensure only members for the *selected* Hiyaw Mahider are added
    this.membersForSelectedHiyawMahider.forEach(member => {
      const memberGroup = this.fb.group({
        userId: [member.uid || '', Validators.required], // Use member.uid as userId
        fullName: [this.cleanMemberName(member.fullName || ''), Validators.required],
        status: ['present', Validators.required], // Default to 'present'
        reason: ['']
      }, { validators: this.validateMemberGroup });

      memberFormArray.push(memberGroup);
    });

    this.attendanceForm.updateValueAndValidity();
  }


  /**
   * Prefills form controls with existing attendance data.
   * No longer attempts to prefill 'userName'.
   */
  prefillMemberControls(existingMembersData: any[]): void {
    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    // Start with all members for the selected Hiyaw Mahider
    this.membersForSelectedHiyawMahider.forEach(member => {
      const existingMemberRecord = existingMembersData.find((m: { userId: any; }) => m.userId === member.uid);

      memberFormArray.push(this.fb.group({
        userId: [member.uid, Validators.required],
        fullName: [member.fullName],
        status: [existingMemberRecord ? existingMemberRecord.status : 'present', Validators.required], // Prefill if found, else default
        reason: [existingMemberRecord ? existingMemberRecord.reason : '']
      }));
    });

    // Optionally, if existingMembersData contains members not in `membersForSelectedHiyawMahider`
    // (e.g., if a member was reassigned or deleted but their attendance remains),
    // you might want to add them as well, perhaps with a visual indicator.
    // For now, we assume `membersForSelectedHiyawMahider` is the definitive list.
  }

  private _filterMembers(value: string): any[] {
    const filterValue = value.toLowerCase();
    // Use membersForSelectedHiyawMahider for filtering in the attendance form,
    // which is already filtered by role and Hiyaw Mahider.
    return this.membersForSelectedHiyawMahider
      .map(member => ({
        ...member,
        fullName: this.cleanMemberName(member.fullName)
      }))
      .filter(member =>
        member.fullName.toLowerCase().includes(filterValue)
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
      searchParams.hiyawMahiderId = this.currentUserAssignedHiyawMahiderId;
      // Ensure the form control also reflects this enforced value if not already set
      if (this.searchForm.get('hiyawMahiderId')?.value !== this.currentUserAssignedHiyawMahiderId) {
        this.searchForm.get('hiyawMahiderId')?.setValue(this.currentUserAssignedHiyawMahiderId, { emitEvent: false });
      }
    }

    try {
      const response: PaginatedAttendanceResponse = await this.attendanceService.searchAttendance(
        searchParams,
        pageIndex,
        pageSize
      );

      // Clean member names in the response
      response.results = response.results.map(result => ({
        ...result,
        memberName: this.cleanMemberName(result.memberName)
      }));

      this.dataSource.data = response.results;
      this.totalResults = response.totalCount;
    } catch (err) {
      console.error('Failed to search attendance:', err);
      this.snackBar.open('Failed to search attendance', 'Close', { duration: 3000 });
      this.dataSource.data = [];
      this.totalResults = 0;
    } finally {
      this.searchLoading = false;
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
    if (!this.selectedHiyawMahider) {
      this.snackBar.open('Please select a Hiyaw Mahider', 'Close', { duration: 3000 });
      return;
    }

    if (this.attendanceForm.invalid) {
      this.markAllAsTouched();

      // Show specific error messages
      if (this.membersFormArray.length === 0) {
        this.snackBar.open('Please add at least one member', 'Close', { duration: 3000 });
      } else {
        this.snackBar.open('Please fill all required fields correctly', 'Close', { duration: 3000 });
      }
      return;
    }

    this.loading = true;

    try {
      const currentDate = this.attendanceForm.get('date')?.value;
      const membersToSubmit = this.attendanceForm.value.members.map((m: any) => ({
        ...m,
        fullName: this.cleanMemberName(m.fullName)
      }));

      const attendanceData = {
        hiyawMahiderId: this.selectedHiyawMahider.id,
        hiyawMahiderName: this.selectedHiyawMahider.name,
        studyDay: this.selectedHiyawMahider.studyDay || '',
        date: currentDate,
        members: membersToSubmit
      };

      if (this.existingAttendanceDocId) {
        await this.attendanceService.updateAttendanceMembers(
          this.existingAttendanceDocId,
          membersToSubmit
        );
        this.snackBar.open('Attendance updated successfully', 'Close', { duration: 3000 });
        this.resetFormAfterUpdate();
        this.searchAttendance();
      } else {
        await this.attendanceService.createAttendance(attendanceData);
        this.snackBar.open('Attendance recorded successfully', 'Close', { duration: 3000 });
        this.clearAttendanceForm();
        this.searchAttendance();
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      this.snackBar.open('Failed to record attendance', 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
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
  const invalidMembers = membersArray.controls.filter(c => c.invalid);
  if (invalidMembers.length > 0) {
    return { invalidMembers: true };
  }

  return null;
}
}