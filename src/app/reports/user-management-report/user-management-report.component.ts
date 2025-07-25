import { Component, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { UserReportService, TransformedUser } from '../../core/user-report.service';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ReportFiltersComponent } from '../report-filters.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-user-management-report',
  standalone: true,
  imports: [
    CommonModule,
    ReportFiltersComponent,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    DatePipe
  ],
  templateUrl: './user-management-report.component.html',
  styleUrls: ['./user-management-report.component.css'],
})
export class UserManagementReportComponent implements AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<TransformedUser>([]);
  displayedColumns: string[] = [
    'email',
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
  pageSizeOptions = [5, 10, 25, 100];
  defaultPageSize = 10;

  totalUsers: number = 0;
  activeUsers: number = 0;
  inactiveUsers: number = 0;

  constructor(
    private userReportService: UserReportService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef 
  ) {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.loadUsers();
  }

  onFiltersChanged(filters: any) {
    // Convert empty/ALL values to undefined
    this.filters = {
      status: filters.status === 'ALL' ? undefined : filters.status,
      role: filters.role === 'ALL' ? undefined : filters.role,
      hiyawMahiderId: filters.hiyawMahiderId === 'ALL' ? undefined : filters.hiyawMahiderId,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined
    };
    
    console.log('Applying filters:', this.filters); 
    this.loadUsers();
  }

  async loadUsers() {
    
    setTimeout(() => {
      this.loading = true;
      this.cdr.detectChanges(); 
    });
    
    this.error = null;
    this.dataSource.data = [];

    try {
      const users: TransformedUser[] = await this.userReportService.getUsers(this.filters);

      console.log('Raw users data from API (via UserReportService):', users);

      if (!users || users.length === 0) {
        this.error = 'No records found matching your filter criteria';
        this.snackBar.open(this.error, 'Dismiss', { duration: 5000 });
        this.updateSummaryData(0, 0, 0, []);
        // Set loading to false here as no data was found
        this.loading = false; 
        return;
      }

      const transformedUsers: TransformedUser[] = await Promise.all(
        users.map(async user => {
          if (user.hiyawMahiderId && user.hiyawMahiderId !== 'N/A') {
            user.hiyawMahider = await this.userReportService.getHiyawMahiderName(user.hiyawMahiderId);
          } else {
            user.hiyawMahider = 'N/A';
          }
          console.log('Transformed user with Hiyaw Mahider name:', user);
          return user;
        })
      );

      console.log('All transformed users (final):', transformedUsers);

      const activeUsers = transformedUsers.filter(u => u.status === 'Active').length;
      const inactiveUsers = transformedUsers.filter(u => u.status === 'Inactive').length;

      this.updateSummaryData(
        transformedUsers.length,
        activeUsers,
        inactiveUsers,
        transformedUsers
      );

    } catch (err) {
      console.error('Error loading users:', err);
      this.error = 'Failed to load user data';
      this.snackBar.open(this.error, 'Dismiss', { duration: 5000 });
      this.updateSummaryData(0, 0, 0, []);
    } finally {
        // Ensure loading is set to false whether success or error
        this.loading = false; 
    }
  }

  private updateSummaryData(total: number, active: number, inactive: number, userList: TransformedUser[]) {
    console.log('Updating data with:', { total, active, inactive, userList });
    this.totalUsers = total;
    this.activeUsers = active;
    this.inactiveUsers = inactive;
    this.dataSource.data = userList;

    if (this.paginator) {
      this.paginator.length = total;
      this.paginator.firstPage();
    }
  }

  exportToCSV() {
    if (this.dataSource.data.length) {
      this.userReportService.exportToCSV(this.dataSource.data, 'user-management-report');
    } else {
      this.snackBar.open('No data available to export', 'Dismiss', { duration: 3000 });
    }
  }

  toggleIds() {
    this.showIds = !this.showIds;
  }
}