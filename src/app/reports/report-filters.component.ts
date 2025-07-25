import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { ReportService } from '../core/report.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule
  ],
  templateUrl: './report-filters.component.html',
  styleUrls: ['./report-filters.component.css'],
  providers: [ReportService]
})
export class ReportFiltersComponent {
  @Output() filtersChanged = new EventEmitter<any>();
  filterForm: FormGroup;

  statusOptions = [
    { value: '', display: 'All Statuses' },
    { value: 'Active', display: 'Active' },
    { value: 'Inactive', display: 'Inactive' }
  ];

  roleOptions = [
    { value: '', display: 'All Roles' },
    { value: 'Admin', display: 'Admin' },
    { value: 'Pastor', display: 'Pastor' },
    { value: 'Member', display: 'Member' }
  ];

  hiyawMahiders$!: Observable<{ id: string; name: string }[]>; // Define the property

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      role: [''],
      hiyawMahiderId: [''],
      startDate: [''],
      endDate: ['']
    });
  }
  ngOnInit() {
    this.hiyawMahiders$ = this.reportService.getHiyawMahiders();
  }

  applyFilters() {
    const filters = this.filterForm.value;
    // Clean up empty values
    Object.keys(filters).forEach(key => {
      if (filters[key] === '' || filters[key] == null) {
        delete filters[key];
      }
    });
    this.filtersChanged.emit(filters);
  }

  resetFilters() {
    this.filterForm.reset();
    this.filtersChanged.emit({});
  }
}