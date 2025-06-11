import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService } from '../../core/report.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ReportFiltersComponent } from '../report-filters.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-user-management-report',
  standalone: true,
  imports: [
    CommonModule,
    ReportFiltersComponent,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    DatePipe
  ],
  templateUrl: './user-management-report.component.html',
  styleUrls: ['./user-management-report.component.css'],
})
export class UserManagementReportComponent {
  reportData$ = new BehaviorSubject<any>(null);
  displayedColumns: string[] = [
    'username', 
    'fullName', 
    'phoneNumber',
    'role',
    'hiyawMahider',
    'status', 
    'createdAt'
  ];
  loading = false;
  filters: any = {};
  error: string | null = null;
  showIds: boolean = false;

  constructor(
    private reportService: ReportService,
    private snackBar: MatSnackBar
  ) {
    this.loadUsers();
  }

  onFiltersChanged(filters: any) {
    this.filters = filters;
    this.loadUsers();
  }

  async loadUsers() {
    this.loading = true;
    this.error = null;
    
    try {
      const users = await firstValueFrom(
        this.reportService.getUsers(this.filters).pipe(
          finalize(() => this.loading = false)
        )
      );
      
      // Transform users with resolved Hiyaw Mahider names
      const transformedUsers = await Promise.all(
        users.map(async user => {
          const transformed = user;
          if (transformed.hiyawMahiderId && transformed.hiyawMahiderId !== 'N/A') {
            transformed.hiyawMahider = await this.reportService.getHiyawMahiderName(transformed.hiyawMahiderId);
          }
          return transformed;
        })
      );
      
      const reportData = this.reportService.generateUserReport(transformedUsers);
      this.reportData$.next(reportData);
    } catch (err) {
      console.error('Error loading users:', err);
      this.error = 'Failed to load user data';
      this.snackBar.open(this.error, 'Dismiss', { duration: 5000 });
    }
  }

  exportToCSV() {
    const currentData = this.reportData$.value;
    if (currentData?.userList?.length) {
      this.reportService.exportToCSV(currentData.userList, 'user-management-report');
    } else {
      this.snackBar.open('No data available to export', 'Dismiss', { duration: 3000 });
    }
  }

  toggleIds() {
    this.showIds = !this.showIds;
  }
}