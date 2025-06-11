import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AttendanceService, SearchAttendanceResult } from '../core/attendance.service';
import { UserService } from '../core/user.service';
import { HiyawMahiderService } from '../core/hiyaw-mahider.service';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { HiyawMahider } from '../core/hiyaw-mahider.model';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker'; // Corrected import closure
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { from, Observable, of } from 'rxjs';
import { map, catchError, switchMap, debounceTime, take, filter, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

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
    ConfirmDialogComponent
  ]
  
})
export class AttendanceComponent implements OnInit {
  @ViewChild('memberSelectFilter') memberSelectFilter: ElementRef | undefined;

  attendanceForm: FormGroup;
  searchForm: FormGroup;
  hiyawMahiders: HiyawMahider[] = [];
  allMembers: any[] = []; // All users in the system
  selectedDate: Date = new Date(); // Renamed to clearly indicate the date selected for the main form
  selectedHiyawMahider: HiyawMahider | null = null;

  // Members assigned to the selected Hiyaw Mahider in the main attendance form
  membersForSelectedHiyawMahider: any[] = [];

  // Members filtered for the search form's member dropdown
  filteredSearchMembers: Observable<any[]>;

  loading: boolean = false;
  searchLoading: boolean = false;
  searchResults: SearchAttendanceResult[] = [];
  displayedColumns: string[] = ['date', 'hiyawMahider', 'member', 'status', 'reason', 'actions'];

  existingAttendanceDocId: string | null = null;
  attendanceAlreadyTaken: boolean = false; // This flag should accurately reflect if a record exists for the *currently selected* HM and date

  // New Form Control for filtering members in the main attendance form
  memberFilterControl = new FormControl('');
  filteredMembersInAttendanceForm: Observable<any[]>;

  selectedStatus: string = ''; // Holds the currently selected status value
  statusOptions = [
    { value: 'present', label: 'Present', description: 'Member attended the session' },
    { value: 'absent', label: 'Absent', description: 'Member did not attend without notice' },
    { value: 'excused', label: 'Excused', description: 'Member informed the group ahead (travel, illness, etc.)' },
    { value: 'late', label: 'Late', description: 'Member joined after the session started' },
    { value: 'new-guest', label: 'New Guest', description: 'First-time visitor or guest' },
    { value: 'follow-up-needed', label: 'Follow-Up Needed', description: 'Absent or struggling members to check in with later' }
  ];

  

  constructor(
    private attendanceService: AttendanceService,
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    private datePipe: DatePipe,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {
    this.attendanceForm = this.fb.group({
      hiyawMahiderId: ['', Validators.required],
      studyDay: [''],
      date: [this.selectedDate, Validators.required],
      members: this.fb.array([])
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
        if (hiyawMahiderId) {
          return this.allMembers.filter(member => member.assignedHiyawMahider === hiyawMahiderId);
        } else {
          return this.allMembers;
        }
      })
    ) || of([]);
  }

  ngOnInit(): void {
    this.loadHiyawMahiders();
    this.loadAllMembers();

    this.attendanceForm.get('hiyawMahiderId')?.valueChanges.pipe(
      debounceTime(300),
      filter(hiyawMahiderId => !!hiyawMahiderId && !!this.attendanceForm.get('date')?.value),
      switchMap(hiyawMahiderId =>
        from(this.checkAndLoadExistingAttendance(hiyawMahiderId, this.attendanceForm.get('date')?.value))
      )
    ).subscribe();

    this.attendanceForm.get('date')?.valueChanges.pipe(
      debounceTime(300),
      filter(date => !!date && !!this.attendanceForm.get('hiyawMahiderId')?.value),
      switchMap(date =>
        from(this.checkAndLoadExistingAttendance(this.attendanceForm.get('hiyawMahiderId')?.value, date))
      )
    ).subscribe();
  }

  get dateControl(): FormControl {
    return this.attendanceForm.get('date') as FormControl;
  }

  loadHiyawMahiders(): void {
    this.loading = true;
    this.hiyawMahiderService.getActiveHiyawMahiders().subscribe({
      next: (hiyawMahiders) => {
        this.hiyawMahiders = hiyawMahiders;
        this.loading = false;
        if (this.hiyawMahiders.length > 0 && !this.attendanceForm.get('hiyawMahiderId')?.value) {
          this.attendanceForm.get('hiyawMahiderId')?.setValue(this.hiyawMahiders[0].id);
        }
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
    
    // If you need to do something with the selected status:
    console.log('Selected status:', status);
    // You can add additional logic here if needed
  }

  loadAllMembers(): void {
    this.userService.getUsersWithDetails().subscribe({
      next: (users) => {
        this.allMembers = users;
        this.searchForm.get('hiyawMahiderId')?.updateValueAndValidity({ emitEvent: true });

        if (this.attendanceForm.get('hiyawMahiderId')?.value) {
          this.onHiyawMahiderSelect(this.attendanceForm.get('hiyawMahiderId')?.value);
        }
      },
      error: (err) => {
        console.error('Failed to load all members:', err);
        this.snackBar.open('Failed to load all members', 'Close', { duration: 3000 });
      }
    });
  }
  onHiyawMahiderSelect(hiyawMahiderId: string): void {
    this.selectedHiyawMahider = this.hiyawMahiders.find(hm => hm.id === hiyawMahiderId) || null;
  
    if (this.selectedHiyawMahider) {
      this.attendanceForm.patchValue({
        hiyawMahiderId: this.selectedHiyawMahider.id,
        studyDay: this.selectedHiyawMahider.studyDay
      }, { emitEvent: false });
  
      this.loading = true;
      this.membersForSelectedHiyawMahider = this.allMembers.filter(user => user.assignedHiyawMahider === hiyawMahiderId);
  
      // Check for existing attendance for each member
      this.checkAndLoadExistingAttendance(hiyawMahiderId, this.selectedDate)
        .then(() => this.loading = false)
        .catch(() => this.loading = false);
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

  onDateChange(date: Date | null): void {
    if (!date) return;
    this.selectedDate = date;
    this.attendanceForm.patchValue({ date: this.selectedDate }, { emitEvent: false });
    if (this.attendanceForm.get('hiyawMahiderId')?.value) {
      this.checkAndLoadExistingAttendance(this.attendanceForm.get('hiyawMahiderId')?.value, this.selectedDate)
        .then(() => this.loading = false)
        .catch(() => this.loading = false);
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
      this.initMemberControls();
      return;
    }
  
    this.loading = true;
    try {
      if (memberId) {
        // Check for specific member attendance
        const existingRecords = await this.attendanceService.getAttendanceForMemberAndDate(memberId, date);
        const memberAttendance = existingRecords.find(record => record.hiyawMahiderId === hiyawMahiderId);
        
        if (memberAttendance) {
          this.existingAttendanceDocId = memberAttendance.id;
          this.attendanceAlreadyTaken = true;
          this.prefillMemberControls(memberAttendance.members);
        } else {
          this.existingAttendanceDocId = null;
          this.attendanceAlreadyTaken = false;
          this.initMemberControls();
        }
      } else {
        // Original behavior - check for Hiyaw Mahider attendance
        const existingRecord = await this.attendanceService.getAttendanceForHiyawMahiderAndDate(hiyawMahiderId, date);
  
        if (existingRecord) {
          this.existingAttendanceDocId = existingRecord.id;
          this.attendanceAlreadyTaken = true;
          this.prefillMemberControls(existingRecord.members);
        } else {
          this.existingAttendanceDocId = null;
          this.attendanceAlreadyTaken = false;
          this.initMemberControls();
        }
      }
    } catch (err) {
      console.error('Error checking existing attendance:', err);
      this.existingAttendanceDocId = null;
      this.attendanceAlreadyTaken = false;
      this.initMemberControls();
    } finally {
      this.loading = false;
    }
  }

  initMemberControls(): void {
    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    this.membersForSelectedHiyawMahider.forEach(member => {
      memberFormArray.push(this.fb.group({
        userId: [member.id, Validators.required],
        userName: [member.userName],
        fullName: [member.fullName],
        status: ['present', Validators.required],
        reason: ['']
      }));
    });
  }

  prefillMemberControls(existingMembersData: any[]): void {
    const memberFormArray = this.attendanceForm.get('members') as FormArray;
    memberFormArray.clear();

    this.membersForSelectedHiyawMahider.forEach(member => {
      const existingMemberRecord = existingMembersData.find((m: { userId: any; }) => m.userId === member.id);
      memberFormArray.push(this.fb.group({
        userId: [member.id, Validators.required],
        userName: [member.userName],
        fullName: [member.fullName],
        status: [existingMemberRecord ? existingMemberRecord.status : 'present', Validators.required],
        reason: [existingMemberRecord ? existingMemberRecord.reason : '']
      }));
    });
  }

  private _filterMembers(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.membersForSelectedHiyawMahider.filter(member =>
      member.fullName.toLowerCase().includes(filterValue) ||
      member.userName.toLowerCase().includes(filterValue)
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

  async searchAttendance(): Promise<void> {
    this.searchLoading = true;
    const searchParams = {
      hiyawMahiderId: this.searchForm.value.hiyawMahiderId,
      memberId: this.searchForm.value.memberId,
      fromDate: this.searchForm.value.fromDate,
      toDate: this.searchForm.value.toDate
    };

    try {
      const results = await this.attendanceService.searchAttendance(searchParams);
      this.searchResults = results;
    } catch (err) {
      console.error('Failed to search attendance:', err);
      this.snackBar.open('Failed to search attendance', 'Close', { duration: 3000 });
    } finally {
      this.searchLoading = false;
    }
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.searchResults = [];
    this.searchForm.get('memberId')?.setValue('');
  }
  async submitAttendance(): Promise<void> {
    if (!this.selectedHiyawMahider) {
      this.snackBar.open('Please select a Hiyaw Mahider', 'Close', { duration: 3000 });
      return;
    }
  
    if (this.attendanceForm.invalid) {
      this.snackBar.open('Please fill all required fields.', 'Close', { duration: 3000 });
      this.attendanceForm.markAllAsTouched();
      return;
    }
  
    this.loading = true;
  
    try {
      const currentHiyawMahiderId = this.attendanceForm.get('hiyawMahiderId')?.value;
      const currentDate = this.attendanceForm.get('date')?.value;
      const membersToSubmit = this.attendanceForm.value.members;
  
      // Create new record (we'll assume it's always a new submission)
      const attendanceData = {
        hiyawMahiderId: this.selectedHiyawMahider.id,
        hiyawMahiderName: this.selectedHiyawMahider.name,
        studyDay: this.selectedHiyawMahider.studyDay || '',
        date: currentDate,
        members: membersToSubmit
      };
      
      await this.attendanceService.createAttendance(attendanceData);
      this.snackBar.open('Attendance recorded successfully', 'Close', { duration: 3000 });
  
      // Reset form for new entry
      this.clearAttendanceForm();
      
    } catch (error) {
      console.error('Error submitting attendance:', error);
      this.snackBar.open('Failed to record attendance', 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }
  

  // Removed the separate updateExistingAttendance method as its logic is now
  // fully integrated into the submitAttendance method for better flow.

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
        // The service method should update a *specific* member within a *specific* document
        await this.attendanceService.updateMemberAttendanceStatus(
          record.id, // This is the ID of the *main attendance document* for that date/HM
          record.memberId, // This is the ID of the specific member within that document
          statusObj.value,
          newReason
        );
        this.snackBar.open('Attendance record updated successfully', 'Close', { duration: 3000 });
        this.searchAttendance(); // Re-run search to update the table
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
          this.searchAttendance();
        } catch (error) {
          console.error('Error deleting attendance record:', error);
          this.snackBar.open('Failed to delete attendance record', 'Close', { duration: 3000 });
        } finally {
          this.loading = false;
        }
      }
    });
  }

  clearAttendanceForm(): void {
    this.dateControl.setValue(new Date());
    this.selectedDate = new Date();
    this.attendanceForm.get('hiyawMahiderId')?.setValue('');
    this.selectedHiyawMahider = null;
    (this.attendanceForm.get('members') as FormArray).clear();
    this.existingAttendanceDocId = null;
    this.attendanceAlreadyTaken = false;
    this.memberFilterControl.setValue('');
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
}