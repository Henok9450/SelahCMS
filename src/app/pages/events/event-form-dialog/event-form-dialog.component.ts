import { Component, Inject, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
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
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Event } from '../../../core/models/events.model';
import { Pastor } from '../../../core/models/pastor.model';
import { convertToDate } from '../../Utility/date.utils';

export interface EventDialogData {
  mode: 'create' | 'edit';
  event: Event;
  pastors: Pastor[];
  eventTypes: { value: string; label: string }[];
}

@Component({
  selector: 'app-event-form-dialog',
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
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-header-icon">{{ data.mode === 'edit' ? 'edit_calendar' : 'event_available' }}</mat-icon>
      <h2 mat-dialog-title>{{ data.mode === 'edit' ? 'Edit Event' : 'Add New Event' }}</h2>
      <button mat-icon-button (click)="onCancel()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <form #eventForm="ngForm">

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Event Title</mat-label>
          <input matInput [(ngModel)]="currentEvent.title" name="title" required minlength="3" />
          <mat-icon matSuffix>title</mat-icon>
          <mat-error *ngIf="eventForm.controls['title']?.errors?.['required']">Title is required</mat-error>
          <mat-error *ngIf="eventForm.controls['title']?.errors?.['minlength']">Title must be at least 3 characters</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Event Type</mat-label>
          <mat-select [(ngModel)]="currentEvent.type" name="type" required>
            <mat-option *ngFor="let type of data.eventTypes" [value]="type.value">{{ type.label }}</mat-option>
          </mat-select>
          <mat-icon matSuffix>category</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Location</mat-label>
          <input matInput [(ngModel)]="currentEvent.location" name="location" />
          <mat-icon matSuffix>location_on</mat-icon>
        </mat-form-field>

        <div class="date-time-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Start Date</mat-label>
            <input matInput [matDatepicker]="startPicker" [(ngModel)]="currentEvent.startDateTime"
              name="startDate" required (dateChange)="validateDates()" />
            <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
            <mat-datepicker #startPicker></mat-datepicker>
            <mat-error *ngIf="eventForm.controls['startDate']?.invalid">Start date required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Start Time</mat-label>
            <input matInput type="time" [(ngModel)]="currentEvent.startTime" name="startTime" required
              (change)="validateDates()" />
            <mat-icon matSuffix>access_time</mat-icon>
            <mat-error *ngIf="eventForm.controls['startTime']?.invalid">Start time required</mat-error>
          </mat-form-field>
        </div>

        <div class="date-time-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>End Date</mat-label>
            <input matInput [matDatepicker]="endPicker" [(ngModel)]="currentEvent.endDate"
              name="endDate" required [min]="currentEvent.startDateTime" (dateChange)="validateDates()" />
            <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
            <mat-datepicker #endPicker></mat-datepicker>
            <mat-error *ngIf="eventForm.controls['endDate']?.invalid">End date required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>End Time</mat-label>
            <input matInput type="time" [(ngModel)]="currentEvent.endTime" name="endTime" required
              (change)="validateDates()" />
            <mat-icon matSuffix>access_time</mat-icon>
            <mat-error *ngIf="eventForm.controls['endTime']?.invalid">End time required</mat-error>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput [(ngModel)]="currentEvent.description" name="description" rows="3"></textarea>
          <mat-icon matSuffix>description</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Assigned Pastors</mat-label>
          <mat-select [(ngModel)]="currentEvent.assignedPastors" name="assignedPastors" multiple>
            <mat-option *ngFor="let pastor of data.pastors" [value]="pastor.id">{{ pastor.name }}</mat-option>
          </mat-select>
          <mat-icon matSuffix>people</mat-icon>
        </mat-form-field>

        <mat-checkbox [(ngModel)]="currentEvent.isCompleted" name="isCompleted" class="checkbox-field">
          Mark as completed
        </mat-checkbox>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-stroked-button (click)="onCancel()" class="cancel-btn">
        <mat-icon>cancel</mat-icon> Cancel
      </button>
      <button
        mat-raised-button
        class="submit-btn"
        (click)="onSubmit()"
        [disabled]="!eventForm.valid || isLoading"
      >
        <mat-spinner diameter="18" *ngIf="isLoading" style="display:inline-block; vertical-align: middle; margin-right:6px;"></mat-spinner>
        <mat-icon *ngIf="!isLoading">{{ data.mode === 'edit' ? 'save' : 'event_available' }}</mat-icon>
        {{ isLoading ? 'Saving...' : (data.mode === 'edit' ? 'Update Event' : 'Create Event') }}
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
      padding: 20px 24px 16px;
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
      padding: 0;
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
      padding: 20px 24px 8px !important;
      max-height: 65vh;
      overflow-y: auto;
      min-width: 500px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 4px;
    }
    .date-time-row {
      display: flex;
      gap: 12px;
      width: 100%;
    }
    .half-width {
      flex: 1;
    }
    .checkbox-field {
      margin: 8px 0 16px;
      display: block;
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
    }
  `],
})
export class EventFormDialogComponent implements OnInit {
  @ViewChild('eventForm') eventForm!: NgForm;
  isLoading = false;
  currentEvent!: Event;

  constructor(
    private dialogRef: MatDialogRef<EventFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EventDialogData,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Deep clone to avoid mutating original
    this.currentEvent = { ...this.data.event };
  }

  validateDates(): void {
    if (
      !this.currentEvent.startDateTime ||
      !this.currentEvent.endDate ||
      !this.currentEvent.startTime ||
      !this.currentEvent.endTime
    ) return;

    const startDateFromPicker = convertToDate(this.currentEvent.startDateTime);
    const endDateFromPicker = convertToDate(this.currentEvent.endDate);
    if (!startDateFromPicker || !endDateFromPicker) return;

    const startDate = new Date(startDateFromPicker.getTime());
    const [sh, sm] = this.currentEvent.startTime.split(':').map(Number);
    startDate.setHours(sh, sm);

    const endDate = new Date(endDateFromPicker.getTime());
    const [eh, em] = this.currentEvent.endTime!.split(':').map(Number);
    endDate.setHours(eh, em);

    if (startDate > endDate) {
      this.snackBar.open('End date/time must be after start date/time', 'Close', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSubmit(): void {
    const title = this.currentEvent.title as unknown as string;
    if (!title || title.length < 3) return;
    if (!this.currentEvent.startDateTime || !this.currentEvent.endDate) {
      this.snackBar.open('Please fill all required date fields.', 'Close', { duration: 3000 });
      return;
    }

    try {
      const startDateFromPicker = convertToDate(this.currentEvent.startDateTime);
      const endDateFromPicker = convertToDate(this.currentEvent.endDate);

      if (!startDateFromPicker || !endDateFromPicker) {
        this.snackBar.open('Invalid date values.', 'Close', { duration: 3000 });
        return;
      }

      const startTimeParts = (this.currentEvent.startTime || '00:00').split(':');
      const endTimeParts = (this.currentEvent.endTime || '00:00').split(':');

      const combinedStartDateTime = new Date(startDateFromPicker.getTime());
      combinedStartDateTime.setHours(+startTimeParts[0], +startTimeParts[1], 0, 0);

      const combinedEndDateTime = new Date(endDateFromPicker.getTime());
      combinedEndDateTime.setHours(+endTimeParts[0], +endTimeParts[1], 0, 0);

      if (combinedStartDateTime > combinedEndDateTime) {
        this.snackBar.open('End date/time must be after start date/time.', 'Close', { duration: 3000 });
        return;
      }

      const eventData: Partial<Event> = {
        ...this.currentEvent,
        startDateTime: combinedStartDateTime,
        endDate: combinedEndDateTime,
        updatedAt: new Date(),
      };
      delete eventData.startTime;
      delete eventData.endTime;

      this.dialogRef.close({ event: eventData });
    } catch (err) {
      this.snackBar.open('Date processing error. Please check inputs.', 'Close', { duration: 3000 });
    }
  }
}
