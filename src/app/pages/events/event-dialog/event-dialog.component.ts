import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';
import { Event } from '../../../core/events.model';
import { Pastor } from '../../../core/pastor.model';

@Component({
  selector: 'app-event-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatNativeDateModule
  ],
  templateUrl: './event-dialog.component.html',
  styleUrls: ['./event-dialog.component.css']
})
export class EventDialogComponent {
  private fb = inject(FormBuilder);
  eventForm: FormGroup;
  pastors: Pastor[] = [];
  eventTypes: { value: string; label: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<EventDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      event?: Event;
      pastors: Pastor[];
      eventTypes: { value: string; label: string }[];
      isEdit?: boolean;
    }
  ) {
    this.pastors = data.pastors;
    this.eventTypes = data.eventTypes;

    this.eventForm = this.fb.group({
      title: [data.event?.title || '', Validators.required],
      description: [data.event?.description || '', Validators.required],
      type: [data.event?.type || '', Validators.required],
      startDateTime: [data.event?.startDateTime ? new Date(data.event.startDateTime as string) : '', Validators.required],
      endDateTime: [data.event?.endDateTime ? new Date(data.event.endDateTime as string) : '', Validators.required],
      location: [data.event?.location || ''],
      assignedPastors: [data.event?.assignedPastors || [], Validators.required]
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.eventForm.valid) {
      const formValue = this.eventForm.value;
      const eventData = {
        ...formValue,
        startDateTime: formValue.startDateTime.toISOString(),
        endDateTime: formValue.endDateTime.toISOString()
      };
      this.dialogRef.close(eventData);
    }
  }
}