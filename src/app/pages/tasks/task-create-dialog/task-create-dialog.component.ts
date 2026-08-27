import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Task } from '../../../../app/core/models/tasks.model';

export interface TaskDialogData {
  hiyawMahiders: any[];
  currentUserRole: string | null;
  selectedHiyawMahiderId: string | null;
  currentUserHiyawMahiderId: string | null;
  currentUserId: string | null;
}

@Component({
  selector: 'app-task-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-header-icon">assignment_add</mat-icon>
      <h2 mat-dialog-title>Create New Task</h2>
      <button mat-icon-button (click)="onCancel()" class="close-btn" matDialogClose>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Task Title</mat-label>
        <input matInput [(ngModel)]="newTask.title" placeholder="Enter task title" required />
        <mat-icon matSuffix>title</mat-icon>
        <mat-error *ngIf="!newTask.title">Title is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <textarea
          matInput
          [(ngModel)]="newTask.description"
          placeholder="Enter task description (optional)"
          rows="3"
        ></textarea>
        <mat-icon matSuffix>description</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Due Date</mat-label>
        <input matInput [matDatepicker]="picker" [(ngModel)]="newTask.dueDate" />
        <mat-hint>MM/DD/YYYY</mat-hint>
        <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-stroked-button (click)="onCancel()" class="cancel-btn">
        <mat-icon>cancel</mat-icon> Cancel
      </button>
      <button
        mat-raised-button
        class="submit-btn"
        (click)="onSubmit()"
        [disabled]="!newTask.title || isLoading"
      >
        <mat-spinner diameter="18" *ngIf="isLoading" style="display:inline-block; vertical-align: middle; margin-right:6px;"></mat-spinner>
        <mat-icon *ngIf="!isLoading">add_task</mat-icon>
        {{ isLoading ? 'Creating...' : 'Create Task' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px 8px;
      border-bottom: 2px solid var(--brand-primary, #00796b);
      background: linear-gradient(135deg, var(--brand-primary, #00796b) 0%, var(--brand-primary-hover, #004d40) 100%);
      border-radius: 8px 8px 0 0;
      position: relative;
    }
    .dialog-header-icon {
      color: var(--brand-accent, #f9a825);
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
    }
    .dialog-header h2[mat-dialog-title] {
      color: #fff;
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
      flex: 1;
    }
    .close-btn {
      color: rgba(255,255,255,0.8);
      position: absolute;
      right: 12px;
      top: 12px;
    }
    .close-btn:hover {
      color: #fff;
    }
    .dialog-content {
      padding: 24px 24px 8px !important;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 420px;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      padding: 12px 24px 20px !important;
      gap: 12px;
      border-top: 1px solid rgba(0,0,0,0.08);
    }
    .cancel-btn {
      color: #666;
    }
    .submit-btn {
      background: linear-gradient(135deg, var(--brand-primary, #00796b), var(--brand-primary-hover, #004d40));
      color: #fff;
      font-weight: 600;
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class TaskCreateDialogComponent {
  isLoading = false;
  newTask: Partial<Task> = {
    title: '',
    description: '',
    status: 'pending',
    dueDate: new Date(),
  };

  constructor(
    private dialogRef: MatDialogRef<TaskCreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSubmit(): void {
    if (!this.newTask.title) return;
    this.dialogRef.close({ task: this.newTask });
  }
}
