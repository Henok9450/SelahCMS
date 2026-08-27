import { Component, OnInit, OnDestroy } from '@angular/core';
import { AttendanceReportService, AttendanceRecord, HiyawMahider, AttendanceReportSummary } from '../../core/services/attendance-report.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of, switchMap, forkJoin, Subscription, Subject } from 'rxjs'; // Added Subject
import { map, tap, takeUntil } from 'rxjs/operators'; // Added takeUntil
import { MatPaginatorModule } from '@angular/material/paginator';
import { AuthService } from '../../core/services/auth.service'; // Adjust this path if different
import { User } from '../../core/models/user.model'; // Adjust this path if different
import { ROLES } from '../../core/utils/role.utils'; // Assuming this provides role constants

import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatSelectModule,
    CommonModule,
    MatButtonModule,
    MatPaginatorModule,
    MatTableModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
  ],
  templateUrl: './attendance-report.component.html',
  styleUrls: ['./attendance-report.component.css']
})
export class AttendanceReportComponent implements OnInit, OnDestroy {
  hiyawMahiders: HiyawMahider[] = [];
  zones: { id: string, name: string }[] = [];
  hiyawMahidersByZone: { [zoneId: string]: HiyawMahider[] } = {};
  reportForm: FormGroup;
  attendanceReport: AttendanceReportSummary | null = null;
  isLoading = false;
  members: string[] = [];
  displayedColumns: string[] = ['date', 'hiyawMahiderName', 'zone', 'memberName', 'studyDay', 'status', 'reason'];

  flattenedRecords: any[] = [];
  pageSize = 10;
  currentPage = 0;
  totalRecords = 0;
  paginatedRecords: any[] = [];

  statusOptions = [
    { value: '', display: 'All Statuses' },
    { value: 'present', display: 'Present' },
    { value: 'absent', display: 'Absent' },
    { value: 'excused', display: 'Excused' },
    { value: 'late', display: 'Late' },
    { value: 'new-guest', display: 'New Guest' },
    { value: 'follow-up-needed', display: 'Follow Up Needed' }
  ];

  currentUser: User | null = null;
  isPastorOrDeputy = false;
  assignedHiyawMahiderId: string | null = null; // Single ID as per your AuthService and User model

  private destroy$ = new Subject<void>(); // Subject for unsubscription

  constructor(
    private attendanceReportService: AttendanceReportService,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.reportForm = this.fb.group({
      zone: [''],
      hiyawMahiderId: [''],
      startDate: [this.getDefaultStartDate()],
      endDate: [new Date()],
      studyDay: [''],
      memberName: [''],
      status: ['']
    });
  }

  ngOnInit() {
    this.authService.authState$.pipe(
      takeUntil(this.destroy$), // Unsubscribe when component is destroyed
      tap(user => {
        this.currentUser = user;
        this.isPastorOrDeputy = user?.role === ROLES.PASTOR || user?.role === ROLES.DEPUTY_PASTOR;
        this.assignedHiyawMahiderId = user?.assignedHiyawMahider || null;
        console.log('[Component] Current user:', this.currentUser);
        console.log('[Component] Is Pastor or Deputy:', this.isPastorOrDeputy);
        console.log('[Component] Assigned Hiyaw Mahider ID:', this.assignedHiyawMahiderId);

        if (this.isPastorOrDeputy && this.assignedHiyawMahiderId) {
          // If Pastor/Deputy, pre-select their assigned Hiyaw Mahider
          this.reportForm.patchValue({ hiyawMahiderId: this.assignedHiyawMahiderId });
          // Load only their assigned Hiyaw Mahider
          this.attendanceReportService.getHiyawMahiders({ id: this.assignedHiyawMahiderId }).pipe(
            takeUntil(this.destroy$)
          ).subscribe(mahiders => {
            this.hiyawMahiders = mahiders;
            if (this.hiyawMahiders.length > 0) {
              this.onHiyawMahiderChange(this.hiyawMahiders[0].id); // Load members for this Hiyaw Mahider
            }
          });
        } else if (!this.isPastorOrDeputy) {
          // For Admin or other roles, load all zones and then all hiyaw mahiders
          this.loadZones();
        }
      })
    ).subscribe({
      error: (err) => console.error('[Component] Error during initial user data load:', err)
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDefaultStartDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }

  resetFilters() {
    this.reportForm.reset({
      zone: '',
      hiyawMahiderId: '',
      startDate: this.getDefaultStartDate(),
      endDate: new Date(),
      studyDay: '',
      memberName: '',
      status: ''
    });
    this.members = [];
    this.attendanceReport = null;
    this.flattenedRecords = [];
    this.currentPage = 0;
    this.totalRecords = 0;
    this.paginatedRecords = [];

    // Re-apply initial filtering for Pastor/Deputy
    if (this.isPastorOrDeputy && this.assignedHiyawMahiderId) {
      this.reportForm.patchValue({ hiyawMahiderId: this.assignedHiyawMahiderId });
      // Reload members for the assigned Hiyaw Mahider
      this.onHiyawMahiderChange(this.assignedHiyawMahiderId);
    } else if (!this.isPastorOrDeputy) {
      // For Admin, reload all Hiyaw Mahiders
      this.hiyawMahiders = Object.values(this.hiyawMahidersByZone).flat();
      console.log('[Component] Filters reset. All Hiyaw Mahiders shown for Admin/Other:', this.hiyawMahiders);
    }
  }

  generateReport() {
    this.isLoading = true;
    const filters = this.reportForm.value;
    const memberStatusFilters = {
      memberName: filters.memberName || '',
      status: filters.status || ''
    };

    console.log('[Component] Initiating report generation with filters:', filters);

    // Ensure hiyawMahiderId is correctly set for Pastor/Deputy
    if (this.isPastorOrDeputy && this.assignedHiyawMahiderId) {
      filters.hiyawMahiderId = this.assignedHiyawMahiderId;
      console.log('[Component] Pastor/Deputy: Forced hiyawMahiderId filter to:', filters.hiyawMahiderId);
    }

    this.attendanceReportService.getOverallExpectedMembersCount(filters).pipe(
      takeUntil(this.destroy$),
      switchMap(totalExpectedMembersOverall => {
        console.log(`[Component] Overall expected members for selected criteria: ${totalExpectedMembersOverall}`);
        return this.attendanceReportService.getAttendanceRecords(filters, this.zones).pipe(
          map(records => ({ records, totalExpectedMembersOverall }))
        );
      })
    ).subscribe({
      next: ({ records, totalExpectedMembersOverall }) => {
        this.attendanceReport = this.attendanceReportService.generateAttendanceReport(
          records,
          memberStatusFilters,
          totalExpectedMembersOverall
        );
        this.flattenedRecords = this.flattenRecords(this.attendanceReport.records);
        this.totalRecords = this.flattenedRecords.length;
        this.currentPage = 0; // Reset to first page
        this.updatePaginatedRecords();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[Component] Error loading attendance records:', err);
        this.isLoading = false;
      }
    });
  }

  private flattenRecords(records: AttendanceRecord[]): any[] {
    return records.flatMap(record => {
      // Use zoneName if available, otherwise use zone ID, fall back to 'Unknown'
      const zoneDisplayName = record.zoneName || 
                            (this.zones.find(z => z.id === record.zone)?.name || 
                            record.zone || 
                            'Unknown');
  
      return record.members.map(member => ({  
        date: record.date,
        hiyawMahiderName: record.hiyawMahiderName,
        zone: zoneDisplayName,
        memberName: member.fullName,
        studyDay: record.studyDay,
        status: member.status,
        reason: member.reason
      }));
    });
  }

  onPageChange(event: any) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedRecords();
  }

  private updatePaginatedRecords() {
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedRecords = this.flattenedRecords.slice(startIndex, endIndex);
  }

  loadZones() {
    this.attendanceReportService.getZones().pipe(
      takeUntil(this.destroy$)
    ).subscribe(zones => {
      this.zones = zones;
      console.log('[Component] Zones loaded:', this.zones);
      this.loadAllHiyawMahiders(); // Load all Hiyaw Mahiders after zones for Admin
    });
  }

  loadAllHiyawMahiders() {
    this.attendanceReportService.getHiyawMahiders().pipe(
      takeUntil(this.destroy$)
    ).subscribe(mahiders => {
      this.hiyawMahiders = mahiders;
      this.hiyawMahidersByZone = {};

      mahiders.forEach(mahider => {
        if (!this.hiyawMahidersByZone[mahider.zone]) {
          this.hiyawMahidersByZone[mahider.zone] = [];
        }
        this.hiyawMahidersByZone[mahider.zone].push(mahider);
      });
      console.log('[Component] All HiyawMahiders loaded and grouped by zone:', this.hiyawMahidersByZone);

      const currentZone = this.reportForm.get('zone')?.value;
      if (currentZone) {
        this.onZoneChange(currentZone); // Apply existing zone filter if any
      } else {
         this.hiyawMahiders = Object.values(this.hiyawMahidersByZone).flat();
      }
      console.log('[Component] Initial Hiyaw Mahiders list for dropdown:', this.hiyawMahiders);
    });
  }

  onHiyawMahiderChange(hiyawMahiderId: string) {
    console.log('[Component] Hiyaw Mahider selection changed to:', hiyawMahiderId);
    this.members = [];

    // Pastor/Deputy: Ensure the selected ID matches their assigned one or is empty (meaning "their" single HM)
    if (this.isPastorOrDeputy && this.assignedHiyawMahiderId && hiyawMahiderId !== this.assignedHiyawMahiderId) {
      console.warn(`[Component] Pastor/Deputy tried to select unauthorized Hiyaw Mahider: ${hiyawMahiderId}. Resetting to assigned.`);
      this.reportForm.get('hiyawMahiderId')?.setValue(this.assignedHiyawMahiderId, { emitEvent: false }); // Reset without triggering loop
      hiyawMahiderId = this.assignedHiyawMahiderId;
    } else if (this.isPastorOrDeputy && !this.assignedHiyawMahiderId) {
       console.warn('[Component] Pastor/Deputy has no assigned Hiyaw Mahider. Cannot load members.');
       return;
    }

    if (!hiyawMahiderId) {
      console.log('[Component] "All Hiyaw Mahiders" selected or no Hiyaw Mahider. Clearing members.');
      return;
    }

    this.attendanceReportService.getUsersByHiyawMahider(hiyawMahiderId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (userNames: string[]) => {
        if (userNames.length > 0) {
          this.members = userNames;
          console.log('[Component] Members (users) loaded for selected Hiyaw Mahider:', this.members);
        } else {
          console.log(`%c[Component] No users found for Hiyaw Mahider ID: "${hiyawMahiderId}"`, 'color: orange;');
          this.members = [];
        }
      },
      error: (err) => {
        console.error('[Component] Error loading users for Hiyaw Mahider:', err);
      }
    });
  }

  onZoneChange(zoneId: string) {
    console.log('[Component] Zone selection changed to:', zoneId);

    // If the user is a Pastor or Deputy Pastor, they should not be able to change zones.
    // This condition should already be handled by *ngIf in template, but good for defensive coding.
    if (this.isPastorOrDeputy) {
      console.warn('[Component] Pastor/Deputy users are not allowed to change zones. Ignoring selection.');
      // Reset to previous value or disable the control
      // this.reportForm.get('zone')?.setValue(this.zones.length > 0 ? this.zones[0].id : '');
      return;
    }

    this.reportForm.patchValue({ hiyawMahiderId: '' }); // Clear Hiyaw Mahider selection when zone changes
    this.members = []; // Clear members when zone changes
    console.log('[Component] Hiyaw Mahider and Members dropdowns reset.');

    if (!zoneId) {
      this.hiyawMahiders = Object.values(this.hiyawMahidersByZone).flat();
      console.log('[Component] "All Zones" selected. Displaying all Hiyaw Mahiders:', this.hiyawMahiders);
    } else {
      this.hiyawMahiders = this.hiyawMahidersByZone[zoneId] || [];
      console.log(`[Component] Zone "${zoneId}" selected. Displaying Hiyaw Mahiders for this zone:`, this.hiyawMahiders);
    }
  }

  exportToCSV() {
    if (this.attendanceReport?.records && this.attendanceReport.records.length > 0) {
      this.attendanceReportService.exportAttendanceRecordsToCSV(
        this.flattenedRecords, // Use the already flattened records
        `attendance_report_${new Date().toISOString().slice(0, 10)}`
      );
      console.log('[Component] Exporting report to CSV.');
    } else {
      console.warn('[Component] No records to export to CSV.');
    }
  }
}
