import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { switchMap, take, first, map } from 'rxjs/operators';
import { forkJoin, Observable } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { FollowUpReportService } from '../../core/services/follow-up-report.service';

import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-follow-up-report',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatInputModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatIconModule
  ],
  templateUrl: './follow-up-report.component.html',
  styleUrls: ['./follow-up-report.component.css']
})
export class FollowUpReportComponent implements OnInit {
  zones$!: Observable<{id: string, name: string}[]>;
  hiyawMahiders$!: Observable<{id: string, name: string, zone: string}[]>;
  filteredHiyawMahiders$!: Observable<{id: string, name: string, zone: string}[]>;
  
  reportForm: FormGroup;
  isLoading = false;
  followUpData: any = null;
  selectedMemberDetails: any = null;

  // Table columns
  absentColumns: string[] = ['fullName', 'hiyawMahiderName', 'zone', 'consecutiveAbsences', 'lastAbsenceDate', 'actions'];
  followUpColumns: string[] = ['fullName', 'hiyawMahiderName', 'zone', 'followUpCount', 'latestFollowUpDate', 'reason', 'actions'];

  constructor(
    public followUpService: FollowUpReportService,
    public fb: FormBuilder,
    private cdRef: ChangeDetectorRef,
  ) {
    this.reportForm = this.fb.group({
      startDate: [this.getDefaultStartDate()],
      endDate: [new Date()],
      zone: [''],
      hiyawMahider: ['']
    });
  }

  ngOnInit() {
   
    this.loadInitialData();
    this.filteredHiyawMahiders$ = this.reportForm.get('zone')!.valueChanges.pipe(
      switchMap((selectedZone) => 
        this.hiyawMahiders$.pipe(
          map(mahiders => 
            mahiders.filter(mahider => !selectedZone || mahider.zone === selectedZone)
          )
        )
    ));
  }

  loadInitialData() {
    this.zones$ = this.followUpService.getZones();
    this.hiyawMahiders$ = this.followUpService.getHiyawMahiders();
  }

  loadMemberDetails(userId: string): void {
    this.followUpService.getMemberDetails(userId).subscribe({
      next: (details) => {
        this.selectedMemberDetails = details;
        console.log('[Component] Member details loaded:', details);
      },
      error: (err) => {
        console.error('[Component] Error loading member details:', err);
      }
    });
  }

  getDefaultStartDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Default to 3 months back
    return date;
  }

  generateReport() {
    this.isLoading = true;
    const filters = {
      startDate: this.reportForm.get('startDate')?.value,
      endDate: this.reportForm.get('endDate')?.value,
      zone: this.reportForm.get('zone')?.value,
      hiyawMahider: this.reportForm.get('hiyawMahider')?.value
    };
  
    this.followUpService.getAttendanceRecords(filters).pipe(
      take(1)
    ).subscribe({
      next: (records) => {
        if (records.length === 0) {
          console.warn('No records found with filters:', filters);
        }
        this.followUpData = this.followUpService.getFollowUpMembers(records);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error:', err);
        this.isLoading = false;
      }
    });
  }

  resetFilters() {
    this.reportForm.reset({
      startDate: this.getDefaultStartDate(),
      endDate: new Date(),
      zone: '',
      hiyawMahider: ''
    });
    this.followUpData = null;
    this.selectedMemberDetails = null;
  }
}
