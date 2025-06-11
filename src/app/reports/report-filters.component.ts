import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatNativeDateModule
  ],
  template: `
    <form [formGroup]="filterForm" (ngSubmit)="applyFilters()">
      <mat-form-field *ngIf="showStatusFilter">
        <mat-label>Status</mat-label>
        <mat-select formControlName="status">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let option of statusOptions" [value]="option.value">
            {{ option.label }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field *ngIf="showUserFilter">
        <mat-label>User</mat-label>
        <input matInput formControlName="user" placeholder="Enter user name">
      </mat-form-field>

      <mat-form-field *ngIf="showDateFilter">
        <mat-label>Start Date</mat-label>
        <input matInput [matDatepicker]="startPicker" formControlName="startDate">
        <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
        <mat-datepicker #startPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field *ngIf="showDateFilter">
        <mat-label>End Date</mat-label>
        <input matInput [matDatepicker]="endPicker" formControlName="endDate">
        <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
        <mat-datepicker #endPicker></mat-datepicker>
      </mat-form-field>

      <button mat-raised-button color="primary" type="submit">Apply Filters</button>
      <button mat-button type="button" (click)="resetFilters()">Reset</button>
    </form>
  `
})
export class ReportFiltersComponent {
  @Input() showStatusFilter: boolean = false; // Control visibility of status filter
  @Input() showUserFilter: boolean = false; // Control visibility of user filter
  @Input() showDateFilter: boolean = false; // Control visibility of date filters
  @Output() filtersChanged = new EventEmitter<any>();

  filterForm: FormGroup;

  statusOptions = [
    { value: 'Present', label: 'Present' },
    { value: 'Absent', label: 'Absent' },
    { value: 'Late', label: 'Late' }
  ];

  constructor(private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      status: [''],
      user: [''],
      startDate: [''],
      endDate: ['']
    });
  }

  applyFilters() {
    this.filtersChanged.emit(this.filterForm.value);
  }

  resetFilters() {
    this.filterForm.reset();
    this.filtersChanged.emit(this.filterForm.value);
  }
}