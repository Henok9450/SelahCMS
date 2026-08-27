import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-attendance-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    DatePipe
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Attendance History' }}</h2>
    <mat-dialog-content>
      <div class="progress-explanation" *ngIf="data.type === 'progress' && data.progressStats">
        <div class="stat-box">
          <div class="stat-value">{{data.progressStats.percentage}}%</div>
          <div class="stat-label">Total Progress</div>
        </div>
        <div class="explanation-text">
            <p><strong>How is this calculated?</strong></p>
            <p>Your progress is based on attendance over the last 3 months.</p>
            <p>You were present for <strong>{{data.progressStats.presentCount}}</strong> out of <strong>{{data.progressStats.totalCount}}</strong> sessions.</p>
        </div>
      </div>

      <div *ngIf="records.length === 0" class="no-records">
        <p>No attendance records found for the last 3 months.</p>
      </div>

      <table mat-table [dataSource]="records" *ngIf="records.length > 0" class="attendance-table">
        <!-- Date Column -->
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef> Date </th>
          <td mat-cell *matCellDef="let record"> {{ record.date | date:'mediumDate' }} </td>
        </ng-container>

        <!-- Status Column -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef> Status </th>
          <td mat-cell *matCellDef="let record">
            <span class="status-badge" [ngClass]="record.status">
              {{ record.status | titlecase }}
            </span>
          </td>
        </ng-container>

        <!-- Reason Column -->
         <ng-container matColumnDef="reason">
          <th mat-header-cell *matHeaderCellDef> Reason </th>
          <td mat-cell *matCellDef="let record"> {{ record.reason || '-' }} </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .attendance-table {
      width: 100%;
      margin-top: 15px;
    }
    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
    }
    .status-badge.present { background-color: #e8f5e9; color: #2e7d32; }
    .status-badge.absent { background-color: #ffebee; color: #c62828; }
    .status-badge.late { background-color: #fff3e0; color: #ef6c00; }
    .status-badge.excused { background-color: #e3f2fd; color: #1565c0; }
    .status-badge.new-guest { background-color: #f3e5f5; color: #7b1fa2; }
    
    .no-records { 
      padding: 20px; 
      text-align: center; 
      color: #666;
    }

    .progress-explanation {
        background-color: #f5f7fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .stat-box {
        text-align: center;
        min-width: 80px;
        padding-right: 20px;
        border-right: 1px solid #ddd;
    }

    .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #1976d2;
    }

    .stat-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
    }

    .explanation-text p {
        margin: 4px 0;
        font-size: 14px;
        color: #444;
    }
  `]
})
export class AttendanceDetailsDialogComponent implements OnInit {
  displayedColumns: string[] = ['date', 'status', 'reason'];
  records: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      rawRecords: any[],
      userId: string,
      memberId?: string,
      title?: string,
      type?: 'progress' | 'records',
      progressStats?: { percentage: number, presentCount: number, totalCount: number }
    }
  ) { }

  ngOnInit(): void {
    this.processRecords();
  }

  private processRecords(): void {
    const { rawRecords, userId, memberId } = this.data;

    this.records = rawRecords.map(record => {
      // Find the member entry for the current user
      const memberEntry = record.members?.find((m: any) =>
        m.userId === userId || (memberId && m.userId === memberId)
      );

      let dateObj: Date;
      if (record.date instanceof Timestamp) {
        dateObj = record.date.toDate();
      } else if (record.date instanceof Date) {
        dateObj = record.date;
      } else {
        dateObj = new Date(record.date);
      }

      return {
        date: dateObj,
        status: memberEntry?.status || memberEntry?.attendanceStatus || 'Unknown',
        reason: memberEntry?.reason
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date desc
  }
}
