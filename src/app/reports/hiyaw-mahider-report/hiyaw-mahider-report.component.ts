import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { HiyawMahiderReportService, HiyawMahider, HiyawMahiderReportData } from '../../core/hiyaw-mahider-report.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Angular Material Imports
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select'; // Added for mat-select
import { MatCardModule } from '@angular/material/card'; // Added for mat-card
import { MatTableDataSource, MatTableModule } from '@angular/material/table'; // Added for mat-table
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'; // Added for mat-paginator
import { MatSort, MatSortModule } from '@angular/material/sort'; // Added for mat-sort


@Component({
  selector: 'app-hiyaw-mahider-report',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule
  ],
  templateUrl: './hiyaw-mahider-report.component.html',
  styleUrls: ['./hiyaw-mahider-report.component.css']
})
export class HiyawMahiderReportComponent implements OnInit, AfterViewInit {
  // Mat-Table properties
  displayedColumns: string[] = [
    'code', 'name', 'HostName', 'HostContactNumber', 'location',
    'pastor', 'deputyPastor', 'status', 'studyDay', 'studyTime',
    'zone', 'createdDate' // 'zone' here refers to the column that will display the zone name
  ];
  dataSource = new MatTableDataSource<HiyawMahider>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  allHiyawMahiders: HiyawMahider[] = []; // Stores all unfiltered data for local filtering/autocomplete
  reportData: HiyawMahiderReportData | null = null;
  zones: { id: string, name: string }[] = [];
  isLoading = false;
  errorMessage = '';

  filterForm: FormGroup;
  filteredOptions!: Observable<HiyawMahider[]>;
  selectedHiyawMahider: HiyawMahider | null = null; // To hold the selected autocomplete option

  constructor(
    private reportService: HiyawMahiderReportService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      zone: [''],
      studyDay: [''],
      searchTerm: [''] // This will hold the autocomplete input value
    });
  }

  ngOnInit(): void {
    this.loadZones();
    this.loadAllHiyawMahiders(); // Load all data initially for local filtering and autocomplete

    // Setup autocomplete filtering
    this.filteredOptions = this.filterForm.get('searchTerm')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300), // Debounce for better performance
      distinctUntilChanged(), // Only emit if value has changed
      map(value => {
        if (typeof value === 'string') {
          return this._filter(value);
        } else if (value && value.id) {
          // If a HiyawMahider object is already selected, show it
          return [value];
        }
        return this.allHiyawMahiders.slice(); // Return a copy of all data if no search term
      })
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Custom filtering for MatTableDataSource (case-insensitive for all fields)
    this.dataSource.filterPredicate = (data: HiyawMahider, filter: string) => {
      // Concatenate all relevant fields, including the resolved zone name
      const dataStr = (
        data.code +
        data.name +
        (data.HostName || '') +
        (data.HostContactNumber || '') +
        data.location +
        data.pastor +
        data.deputyPastor +
        data.status +
        data.studyDay +
        data.studyTime +
        this.getZoneName(data.zone) + // Include the display name of the zone in the filter string
        data.createdDate
      ).toLowerCase();
      return dataStr.includes(filter); // Use includes for better search
    };
  }

  private _filter(value: string): HiyawMahider[] {
    const filterValue = value.toLowerCase();
    return this.allHiyawMahiders.filter(hm =>
      hm.name.toLowerCase().includes(filterValue) ||
      hm.code.toLowerCase().includes(filterValue)
    );
  }

  loadZones(): void {
    this.isLoading = true;
    this.reportService.getZones().subscribe({
      next: (zones) => {
        this.zones = zones;
        console.log('Component: Zones array after loadZones:', this.zones);
        // Don't set isLoading to false here, as loadAllHiyawMahiders will do it
      },
      error: (err) => {
        this.errorMessage = 'Failed to load zones.';
        console.error('Error loading zones:', err);
        this.isLoading = false;
      }
    });
  }

  loadAllHiyawMahiders(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.reportService.getHiyawMahiders({}).subscribe({
      next: (data) => {
        this.allHiyawMahiders = data; // Store all data
        console.log('Component: All Hiyaw Mahiders raw data:', this.allHiyawMahiders);
        this.applyFilters(); // Apply initial filters to populate table and summary
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load Hiyaw Mahiders data.';
        console.error('Error loading all Hiyaw Mahiders:', err);
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filters = this.filterForm.value;

    let filteredList = [...this.allHiyawMahiders]; // Start with all data

    if (filters.status) {
      filteredList = filteredList.filter(hm => hm.status === filters.status);
    }

    if (filters.zone) {
      filteredList = filteredList.filter(hm => hm.zone === filters.zone);
    }

    if (filters.studyDay) {
      filteredList = filteredList.filter(hm => hm.studyDay === filters.studyDay);
    }

    if (filters.searchTerm) {
      if (typeof filters.searchTerm === 'string') {
        const searchTermLower = filters.searchTerm.toLowerCase();
        filteredList = filteredList.filter(hm =>
          hm.name.toLowerCase().includes(searchTermLower) ||
          hm.code.toLowerCase().includes(searchTermLower)
        );
      } else if (filters.searchTerm.id) {
        // If a Hiyaw Mahider object was selected from autocomplete
        filteredList = filteredList.filter(hm => hm.id === filters.searchTerm.id);
      }
    }

    this.dataSource.data = filteredList; // Update MatTableDataSource with the filtered data
    console.log('Component: Data used for report generation (filteredList):', filteredList);
    console.log('Component: Zones array passed to generateHiyawMahiderReport:', this.zones);
    // Generate report data from the currently filtered list (dataSource.data)
    this.reportData = this.reportService.generateHiyawMahiderReport(this.dataSource.data, this.zones);
    this.isLoading = false;

    if (this.paginator) {
      this.paginator.firstPage(); // Reset paginator to first page on new filters
    }
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      zone: '',
      studyDay: '',
      searchTerm: ''
    });
    this.selectedHiyawMahider = null; // Clear selected autocomplete value
    this.applyFilters(); // Apply filters to show all initial data
  }

  exportToCSV(): void {
    // Transform the current table data (this.dataSource.data) into the format
    // that the service's exportToCSV method expects.
    // The service's exportToCSV method is designed to take HiyawMahider[]
    // and expects a 'zoneName' property for the Zone column.
    const dataToExport = this.dataSource.data.map(hm => {
      return {
        ...hm, // Keep all original HiyawMahider properties
        zoneName: this.getZoneName(hm.zone) // Add the zoneName property using the helper method
      };
    });

    // Pass the correctly formatted data to the service's exportToCSV method
    this.reportService.exportToCSV(dataToExport, 'hiyaw_mahiders_report');
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  getStatusClass(status: string): string {
    return status === 'Active' ? 'status-active' : 'status-inactive';
  }

  displayHiyawMahiderName(hm?: HiyawMahider): string {
    return hm ? `${hm.code} - ${hm.name}` : '';
  }

getZoneName(zoneValue: string): string {
  console.log(`Component: Looking up zone for value: "${zoneValue}"`);
  
  // First check if this is a direct zone name that exists in our zones array
  const zoneByName = this.zones.find(z => z.name === zoneValue);
  if (zoneByName) {
    return zoneByName.name;
  }
  
  // Otherwise treat it as an ID lookup
  const zoneById = this.zones.find(z => z.id === zoneValue);
  const result = zoneById?.name || `Unknown Zone (${zoneValue})`;
  
  console.log(`Component: Found for "${zoneValue}": ${result}`);
  return result;
}

  onOptionSelected(event: any): void {
    this.selectedHiyawMahider = event.option.value;
    // The form control's value will automatically be set to the selected object
    // by MatAutocomplete. There's no need to manually call setValue here,
    // as it might interfere with the displayWith function.
  }
}
