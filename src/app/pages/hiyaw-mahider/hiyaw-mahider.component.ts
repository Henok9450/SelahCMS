import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { PastorService } from '../../core/pastor.service';
import { ZoneService } from '../../core/zone.service';
import { HiyawMahider, HiyawMahiderStatus } from '../../core/hiyaw-mahider.model';
import { Pastor } from '../../core/pastor.model';
import { Zone } from '../../core/zone.model';
import { Observable, catchError, of, tap } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table'; // Import MatTableModule and MatTableDataSource
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'; // Import MatPaginatorModule and MatPaginator

@Component({
  selector: 'app-hiyaw-mahider',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatTableModule, // Add MatTableModule
    MatPaginatorModule // Add MatPaginatorModule
  ],
  templateUrl: './hiyaw-mahider.component.html',
  styleUrls: ['./hiyaw-mahider.component.css']
})
export class HiyawMahiderComponent implements OnInit, AfterViewInit {
  // Mat-Table properties
  displayedColumns: string[] = [
    'code', 'name', 'location', 'hostName', 'hostContactNumber',
    'zone', 'status', 'pastor', 'deputyPastor', 'study', 'createdDate', 'actions'
  ];
  dataSource = new MatTableDataSource<HiyawMahider>([]); // Initialize MatTableDataSource

  @ViewChild(MatPaginator) paginator!: MatPaginator; // Get reference to MatPaginator

  newHiyawMahider: Omit<HiyawMahider, 'id' | 'createdDate'>;
  searchFilters = {
    name: '',
    pastor: '',
    deputyPastor: '',
    status: '' as HiyawMahiderStatus | '',
    code: '',
    location: '',
    zone: ''
  };

  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  codeError: string | null = null;
  // showAllResults is no longer needed with mat-paginator
  // showAllResults = false;
  initialLoadComplete = false; // Added to handle initial empty state message

  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  statusOptions: HiyawMahiderStatus[];

  // Pastor selection properties
  pastors: Pastor[] = [];
  // Separate filtered lists for create and edit forms
  filteredPastorsCreate: Pastor[] = [];
  filteredDeputyPastorsCreate: Pastor[] = [];
  filteredPastorsEdit: Pastor[] = [];
  filteredDeputyPastorsEdit: Pastor[] = [];

  // Dropdown visibility is handled by mat-autocomplete, no longer needed
  // showPastorDropdown = false;
  // showDeputyPastorDropdown = false;

  // Search terms for autocomplete, separated by form
  pastorSearchTermCreate = '';
  deputyPastorSearchTermCreate = '';
  pastorSearchTermEdit = '';
  deputyPastorSearchTermEdit = '';

  zones: Zone[] = [];

  // Edit mode properties
  editingItem: HiyawMahider | null = null;
  isEditMode = false;
  processingIds: Set<string> = new Set();

  constructor(
    private hiyawMahiderService: HiyawMahiderService,
    private pastorService: PastorService,
    private zoneService: ZoneService
  ) {
    this.statusOptions = this.hiyawMahiderService.getStatusOptions();
    this.newHiyawMahider = this.getDefaultHiyawMahider();
  }

  ngOnInit(): void {
    this.loadPastors();
    this.loadZones();
    this.loadHiyawMahiders();
  }

  ngAfterViewInit(): void {
    // Connect the paginator to the MatTableDataSource after the view has initialized
    this.dataSource.paginator = this.paginator;
  }

  // Get only active pastors
  getActivePastors(): Pastor[] {
    return this.pastors.filter(pastor => pastor.status === 'Active');
  }

  // Modified handlePastorInput to differentiate between create/edit forms
  handlePastorInput(event: Event, fieldType: 'pastor' | 'deputyPastor', formType: 'create' | 'edit'): void {
    const inputElement = event.target as HTMLInputElement;
    const searchTerm = inputElement.value;

    if (formType === 'create') {
      if (fieldType === 'pastor') {
        this.pastorSearchTermCreate = searchTerm;
        this.filterPastors(this.pastorSearchTermCreate, 'create', 'pastor');
      } else {
        this.deputyPastorSearchTermCreate = searchTerm;
        this.filterPastors(this.deputyPastorSearchTermCreate, 'create', 'deputyPastor');
      }
    } else { // formType === 'edit'
      if (fieldType === 'pastor') {
        this.pastorSearchTermEdit = searchTerm;
        this.filterPastors(this.pastorSearchTermEdit, 'edit', 'pastor');
      } else {
        this.deputyPastorSearchTermEdit = searchTerm;
        this.filterPastors(this.deputyPastorSearchTermEdit, 'edit', 'deputyPastor');
      }
    }
  }

  getSafeDate(date: string | Date): Date | null {
    if (date instanceof Date) {
      return date;
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d; // Return null if invalid, otherwise the Date object
  }

  loadPastors(): void {
    this.pastorService.getPastors().subscribe({
      next: (pastors) => {
        this.pastors = pastors;
        // Initialize filtered lists for both forms
        this.filteredPastorsCreate = this.getActivePastors();
        this.filteredDeputyPastorsCreate = this.getActivePastors();
        this.filteredPastorsEdit = this.getActivePastors();
        this.filteredDeputyPastorsEdit = this.getActivePastors();
      },
      error: (error) => {
        console.error('Error loading pastors:', error);
        this.errorMessage = 'Failed to load pastors. Please try again later.';
      }
    });
  }

  loadZones(): void {
    this.zoneService.getZones().subscribe({
      next: (zones) => {
        this.zones = zones;
      },
      error: (error) => {
        console.error('Error loading zones:', error);
        this.errorMessage = 'Failed to load zones. Please try again later.';
      }
    });
  }

  loadHiyawMahiders(): void {
    this.processingIds.clear(); // Clear any pending operations
    this.isLoading = true;
    this.errorMessage = null;

    // Remove applyLimit as mat-paginator handles it
    // const applyLimit = !this.hasActiveFilters() && !this.showAllResults;

    this.hiyawMahiderService.searchHiyawMahiders({
      name: this.searchFilters.name,
      pastor: this.searchFilters.pastor,
      deputyPastor: this.searchFilters.deputyPastor,
      status: this.searchFilters.status || undefined,
      code: this.searchFilters.code,
      location: this.searchFilters.location,
      zone: this.searchFilters.zone || undefined
    } /*, applyLimit */).pipe( // Removed applyLimit parameter
      tap((hiyawMahiders) => {
        this.dataSource.data = hiyawMahiders; // Assign data to MatTableDataSource
        if (this.paginator) {
          this.paginator.firstPage(); // Go to first page on new search/load
        }
        this.isLoading = false;
        this.initialLoadComplete = true; // Mark initial load as complete
      }),
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = error.message;
        this.dataSource.data = []; // Clear data on error
        this.initialLoadComplete = true; // Mark initial load as complete even on error
        return of([]);
      })
    ).subscribe();
  }

  // Updated filterPastors to accept formType and fieldType
  filterPastors(searchTerm: string, formType: 'create' | 'edit', fieldType: 'pastor' | 'deputyPastor'): void {
    const activePastors = this.getActivePastors();

    if (!searchTerm) {
      if (formType === 'create') {
        if (fieldType === 'pastor') {
          this.filteredPastorsCreate = activePastors;
        } else {
          this.filteredDeputyPastorsCreate = activePastors;
        }
      } else { // edit form
        if (fieldType === 'pastor') {
          this.filteredPastorsEdit = activePastors;
        } else {
          this.filteredDeputyPastorsEdit = activePastors;
        }
      }
      return;
    }

    const filtered = activePastors.filter(pastor =>
      pastor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (formType === 'create') {
      if (fieldType === 'pastor') {
        this.filteredPastorsCreate = filtered;
      } else {
        this.filteredDeputyPastorsCreate = filtered;
      }
    } else { // edit form
      if (fieldType === 'pastor') {
        this.filteredPastorsEdit = filtered;
      } else {
        this.filteredDeputyPastorsEdit = filtered;
      }
    }
  }

  // selectPastor now sets the value directly
  selectPastor(pastor: Pastor, field: 'pastor' | 'deputyPastor' | 'editPastor' | 'editDeputyPastor'): void {
    if (!pastor) return;

    if (field.startsWith('edit')) {
      if (this.editingItem) {
        if (field === 'editPastor') {
          this.editingItem.pastor = pastor.name;
          this.pastorSearchTermEdit = pastor.name; // Update search term to show selected value
        } else {
          this.editingItem.deputyPastor = pastor.name;
          this.deputyPastorSearchTermEdit = pastor.name; // Update search term
        }
      }
    } else {
      if (field === 'pastor') {
        this.newHiyawMahider.pastor = pastor.name;
        this.pastorSearchTermCreate = pastor.name; // Update search term
      } else {
        this.newHiyawMahider.deputyPastor = pastor.name;
        this.deputyPastorSearchTermCreate = pastor.name; // Update search term
      }
    }
    // Autocomplete handles dropdown closing, no need for explicit closeDropdowns()
  }

  // This method is no longer directly needed as mat-autocomplete handles dropdown visibility
  // toggleDropdown(...) method removed

  // Clear search terms for create form. Edit form terms are managed by direct model binding.
  clearSearchTerms(): void {
    this.pastorSearchTermCreate = '';
    this.deputyPastorSearchTermCreate = '';
  }

  hasActiveFilters(): boolean {
    return Object.values(this.searchFilters).some(
      value => value !== undefined && value !== null && value !== ''
    );
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.codeError = null;

    try {
      const codeExists = await this.hiyawMahiderService.isCodeExists(this.newHiyawMahider.code);
      if (codeExists) {
        this.codeError = 'This code is already in use';
        this.isLoading = false;
        return;
      }

      const exists = await this.hiyawMahiderService.isHiyawMahiderExists(
        this.newHiyawMahider.name,
        this.newHiyawMahider.location
      );

      if (exists) {
        this.errorMessage = 'A Hiyaw Mahider with this name and location already exists';
        this.isLoading = false;
        return;
      }

      const created = await this.hiyawMahiderService.createHiyawMahider({
        ...this.newHiyawMahider,
        code: this.newHiyawMahider.code.trim()
      });

      this.successMessage = `Hiyaw Mahider "${created.name}" created successfully with code "${created.code}"`;
      this.resetForm();
      this.loadHiyawMahiders(); // Reload data to update the mat-table
      setTimeout(() => this.successMessage = null, 5000);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to create Hiyaw Mahider. Please try again.';
      console.error('Error creating Hiyaw Mahider:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    // showAllResults is no longer used, searching will automatically update the table with pagination
    this.loadHiyawMahiders();
  }

  // showAll() method is no longer necessary due to mat-paginator
  // showAll(): void {
  //   this.showAllResults = true;
  //   this.loadHiyawMahiders();
  // }

  resetForm(): void {
    this.newHiyawMahider = this.getDefaultHiyawMahider();
    this.codeError = null;
    this.clearSearchTerms(); // Clear autocomplete search terms
  }

  resetSearch(): void {
    this.searchFilters = {
      name: '',
      pastor: '',
      deputyPastor: '',
      status: '',
      code: '',
      location: '',
      zone: ''
    };
    // showAllResults is no longer used
    // this.showAllResults = false;
    this.loadHiyawMahiders();
  }

  private validateForm(): boolean {
    this.errorMessage = null;
    this.codeError = null;

    if (!this.newHiyawMahider.name?.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }
    if (!this.newHiyawMahider.HostName?.trim()) {
      this.errorMessage = 'Host Name is required';
      return false;
    }
    if (!this.newHiyawMahider.HostContactNumber?.trim()) {
      this.errorMessage = 'Host Contact Number is required';
      return false;
    }
    if (!this.newHiyawMahider.location?.trim()) {
      this.errorMessage = 'Location is required';
      return false;
    }
    if (!this.newHiyawMahider.code?.trim()) {
      this.codeError = 'Code is required';
      return false;
    }
    if (!/^[A-Za-z0-9\-_]+$/.test(this.newHiyawMahider.code)) {
      this.codeError = 'Code can only contain letters, numbers, hyphens, and underscores';
      return false;
    }

    return true;
  }
  private getDefaultHiyawMahider(): Omit<HiyawMahider, 'id' | 'createdDate'> {
    return {
      name: '',
      HostName: '',
      HostContactNumber: '',
      code: '',
      location: '',
      status: 'Active',
      pastor: null,
      zone: null,
      deputyPastor: null,
      studyDay: null,
      studyTime: null
    };
  }

  getZoneName(zoneId: string | null): string | null {
    if (!zoneId) return null;
    const zone = this.zones.find(z => z.id === zoneId);
    return zone ? zone.name : null;
  }

  onDelete(id: string, name: string): void {
    if (confirm(`Are you sure you want to delete the Hiyaw Mahider "${name}"?`)) {
      this.processingIds.add(id);
      this.hiyawMahiderService.deleteHiyawMahider(id).then(() => {
        this.successMessage = `Hiyaw Mahider "${name}" deleted successfully.`;
        this.loadHiyawMahiders(); // Reload data to update the mat-table
        setTimeout(() => this.successMessage = null, 5000);
      }).catch(error => {
        this.errorMessage = `Failed to delete Hiyaw Mahider "${name}". Please try again.`;
        console.error('Error deleting Hiyaw Mahider:', error);
      }).finally(() => {
        this.processingIds.delete(id); // Ensure ID is removed in all cases
      });
    }
  }

  startEdit(hm: HiyawMahider): void {
    this.editingItem = { ...hm };
    this.isEditMode = true;
    this.successMessage = null;
    this.errorMessage = null;
    // Set initial search terms for edit form autocomplete
    this.pastorSearchTermEdit = this.editingItem.pastor || '';
    this.deputyPastorSearchTermEdit = this.editingItem.deputyPastor || '';
  }

  cancelEdit(): void {
    if (this.editingItem && this.editingItem.id) {
      this.processingIds.delete(this.editingItem.id);
    }
    this.isEditMode = false;
    this.editingItem = null;
    this.errorMessage = null;
    this.successMessage = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editingItem || !this.editingItem.id) return;

    if (!window.confirm(`Are you sure you want to update "${this.editingItem.name}"?`)) {
      return;
    }

    const itemId = this.editingItem.id;
    this.processingIds.add(itemId);
    this.isLoading = true;
    this.errorMessage = null;

    try {
      const updatedItem = await this.hiyawMahiderService.updateHiyawMahider(
        itemId,
        {
          name: this.editingItem.name,
          HostName: this.editingItem.HostName,
          HostContactNumber: this.editingItem.HostContactNumber,
          code: this.editingItem.code,
          location: this.editingItem.location,
          status: this.editingItem.status,
          pastor: this.editingItem.pastor,
          zone: this.editingItem.zone,
          deputyPastor: this.editingItem.deputyPastor,
          studyDay: this.editingItem.studyDay,
          studyTime: this.editingItem.studyTime
        }
      );

      this.successMessage = `Hiyaw Mahider "${updatedItem.name}" updated successfully`;
      this.isEditMode = false;
      this.editingItem = null;
      this.loadHiyawMahiders(); // Reload data to update the mat-table
      setTimeout(() => this.successMessage = null, 5000);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to update Hiyaw Mahider';
      console.error('Error updating Hiyaw Mahider:', error);
    } finally {
      this.processingIds.delete(itemId);
      this.isLoading = false;
    }
  }
}