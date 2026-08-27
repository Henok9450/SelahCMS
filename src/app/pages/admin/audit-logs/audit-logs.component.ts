import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuditLog } from '../../../core/models/audit-log.model';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCardModule
  ],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  private auditLogService = inject(AuditLogService);
  private fb = inject(FormBuilder);

  filterForm: FormGroup;
  logs: AuditLog[] = [];
  paginatedLogs: AuditLog[] = [];
  isLoading = false;
  pageSize = 25;
  currentPage = 0;
  totalLogs = 0;

  displayedColumns: string[] = ['timestamp', 'actor', 'role', 'category', 'action', 'target', 'details'];

  categories: string[] = ['Auth', 'Member', 'Attendance', 'Study Material', 'Hiyaw Mahider', 'Pastor', 'Zone', 'Task'];

  private destroy$ = new Subject<void>();

  constructor() {
    this.filterForm = this.fb.group({
      category: [''],
      actorSearch: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    this.fetchLogs();

    this.filterForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.fetchLogs();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchLogs(): void {
    this.isLoading = true;
    const filters = this.filterForm.value;

    this.auditLogService.getLogs(filters).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (logs) => {
        this.logs = logs;
        this.totalLogs = logs.length;
        this.currentPage = 0;
        this.updatePaginatedLogs();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load audit logs:', err);
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: any): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedLogs();
  }

  updatePaginatedLogs(): void {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedLogs = this.logs.slice(start, end);
  }

  resetFilters(): void {
    this.filterForm.reset({
      category: '',
      actorSearch: '',
      startDate: null,
      endDate: null
    });
  }

  exportCSV(): void {
    this.auditLogService.exportLogsToCSV(this.logs, 'system_audit_logs');
  }

  getCategoryColor(category: string): string {
    switch (category) {
      case 'Auth': return 'badge-auth';
      case 'Member': return 'badge-member';
      case 'Attendance': return 'badge-attendance';
      case 'Study Material': return 'badge-material';
      case 'Hiyaw Mahider': return 'badge-hiyaw';
      case 'Pastor': return 'badge-pastor';
      case 'Zone': return 'badge-zone';
      default: return 'badge-default';
    }
  }

  formatDetails(details: any): string {
    if (!details) return '-';
    try {
      return JSON.stringify(details);
    } catch {
      return String(details);
    }
  }
}
