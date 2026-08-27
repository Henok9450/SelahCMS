import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReportService } from '../core/services/report.service';
import { Observable } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-attendance-filters',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatNativeDateModule
  ],
  templateUrl: './attendance-filters.component.html',
  styleUrls: ['./attendance-filters.component.css']
})
export class AttendanceFiltersComponent implements OnInit {
    @Output() filtersChanged = new EventEmitter<any>();
    filterForm: FormGroup;
    hiyawMahiders$!: Observable<any[]>; 
    studyDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
    constructor(
      private fb: FormBuilder,
      private reportService: ReportService
    ) {
      this.filterForm = this.fb.group({
        hiyawMahiderId: [''],
        studyDay: [''],
        startDate: [''],
        endDate: ['']
      });
    }
  
    ngOnInit() {
      this.hiyawMahiders$ = this.reportService.getHiyawMahiders();
    }
  
    applyFilters() {
      // Emit only the values that have been set
      const filters = {
        hiyawMahiderId: this.filterForm.value.hiyawMahiderId || null,
        studyDay: this.filterForm.value.studyDay || null,
        startDate: this.filterForm.value.startDate || null,
        endDate: this.filterForm.value.endDate || null
      };
      this.filtersChanged.emit(filters);
    }
  
    resetFilters() {
      this.filterForm.reset();
      this.filtersChanged.emit({
        hiyawMahiderId: null,
        studyDay: null,
        startDate: null,
        endDate: null
      });
    }
  }
