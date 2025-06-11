import { Component, OnInit } from '@angular/core';
import { ReportService } from '../../core/report.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms'; 
import { ChartsModule } from 'ng2-charts'; 

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    ReactiveFormsModule, // Add ReactiveFormsModule here
    DatePipe,
    ChartsModule
  ],
  templateUrl: './attendance-report.component.html',
  styleUrls: ['./attendance-report.component.scss'],
  providers: [DatePipe]
})
export class AttendanceReportComponent implements OnInit {
  reportForm: FormGroup;
  isLoading = false;
  reportData: any;
  filteredRecords: any[] = [];
  
  // Filters for the detailed records table
  statusFilter = '';
  userFilter = '';
  hiyawMahiderFilter = '';
  zoneFilter = '';

  // Chart data
  summaryChartData: any;
  byUserChartData: any;
  byHiyawMahiderChartData: any;
  byZoneChartData: any;
  byDateChartData: any;

  constructor(
    private reportService: ReportService,
    private fb: FormBuilder,
    private datePipe: DatePipe
  ) {
    this.reportForm = this.fb.group({
      startDate: [this.getDefaultStartDate()],
      endDate: [new Date()],
      userId: [''],
      hiyawMahiderId: [''],
      zone: [''],
      status: ['']
    });
  }

  ngOnInit(): void {
    this.generateReport();
  }

  getDefaultStartDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 1); // Default to last month
    return date;
  }

  generateReport(): void {
    this.isLoading = true;
    const filters = {
      startDate: this.reportForm.value.startDate,
      endDate: this.reportForm.value.endDate,
      userId: this.reportForm.value.userId,
      hiyawMahiderId: this.reportForm.value.hiyawMahiderId,
      zone: this.reportForm.value.zone,
      status: this.reportForm.value.status
    };

    this.reportService.getAttendanceRecords(filters).subscribe({
      next: (records) => {
        this.reportData = this.reportService.generateAttendanceReport(records);
        this.filteredRecords = [...this.reportData.records];
        this.prepareChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error generating report:', err);
        this.isLoading = false;
      }
    });
  }

  prepareChartData(): void {
    // Summary chart (pie chart)
    this.summaryChartData = {
      labels: ['Present', 'Absent', 'Late', 'Excused'],
      datasets: [
        {
          data: [
            this.reportData.summary.present,
            this.reportData.summary.absent,
            this.reportData.summary.late,
            this.reportData.summary.excused
          ],
          backgroundColor: ['#4CAF50', '#F44336', '#FFC107', '#9E9E9E']
        }
      ]
    };

    // By User chart (horizontal bar)
    this.byUserChartData = {
      labels: this.reportData.byUser.map((u: any) => u.userName),
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: this.reportData.byUser.map((u: any) => u.rate),
          backgroundColor: '#2196F3'
        }
      ]
    };

    // By Hiyaw Mahider chart (bar)
    this.byHiyawMahiderChartData = {
      labels: this.reportData.byHiyawMahider.map((h: any) => h.hiyawMahiderId),
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: this.reportData.byHiyawMahider.map((h: any) => h.rate),
          backgroundColor: '#673AB7'
        }
      ]
    };

    // By Zone chart (pie)
    this.byZoneChartData = {
      labels: this.reportData.byZone.map((z: any) => z.zone),
      datasets: [
        {
          data: this.reportData.byZone.map((z: any) => z.present),
          backgroundColor: ['#FF5722', '#607D8B', '#00BCD4', '#8BC34A']
        }
      ]
    };

    // By Date chart (line)
    this.byDateChartData = {
      labels: this.reportData.byDate.map((d: any) => d.date),
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: this.reportData.byDate.map((d: any) => d.rate),
          borderColor: '#009688',
          fill: false
        }
      ]
    };
  }

  applyFilters(): void {
    this.filteredRecords = this.reportData.records.filter((record: any) => {
      return (
        (!this.statusFilter || record.status === this.statusFilter) &&
        (!this.userFilter || record.userId === this.userFilter) &&
        (!this.hiyawMahiderFilter || record.hiyawMahiderId === this.hiyawMahiderFilter) &&
        (!this.zoneFilter || record.zone === this.zoneFilter)
      );
    });
  }

  resetFilters(): void {
    this.statusFilter = '';
    this.userFilter = '';
    this.hiyawMahiderFilter = '';
    this.zoneFilter = '';
    this.filteredRecords = [...this.reportData.records];
  }

  exportToCSV(): void {
    if (this.reportData) {
      const dateRange = `${this.datePipe.transform(this.reportForm.value.startDate, 'yyyy-MM-dd')}_to_${this.datePipe.transform(this.reportForm.value.endDate, 'yyyy-MM-dd')}`;
      this.reportService.exportAttendanceReportToCSV(this.reportData, `Attendance_Report_${dateRange}`);
    }
  }
  getUniqueUsers(): string[] {
    return [...new Set(this.reportData.records.map((r: any) => r.userId))] as string[];
  }
  
  getUniqueHiyawMahiders(): string[] {
    return [...new Set(this.reportData.records.map((r: any) => r.hiyawMahiderId).filter((id: string) => id))] as string[];
  }
  
  getUniqueZones(): string[] {
    return [...new Set(this.reportData.records.map((r: any) => r.zone).filter((zone: string) => zone))] as string[];
  }
  
  getUniqueStatuses(): string[] {
    return [...new Set(this.reportData.records.map((r: any) => r.status))] as string[];
  }
}