import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PastorService } from '../../core/pastor.service';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { Pastor } from '../../core/pastor.model';
import { HiyawMahider } from '../../core/hiyaw-mahider.model'; // Import HiyawMahider model
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar'; // For snackbar notifications
import { MatTableDataSource, MatTableModule } from '@angular/material/table'; // Mat Table
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'; // Mat Paginator
import { MatTooltipModule } from '@angular/material/tooltip'; // For tooltips on actions

@Component({
  selector: 'app-pastor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    // Angular Material Modules
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,        // Added for mat-table
    MatPaginatorModule,     // Added for mat-paginator
    MatTooltipModule
  ],
  templateUrl: './pastor.component.html',
  styleUrls: ['./pastor.component.css']
})
export class PastorComponent implements OnInit, AfterViewInit {
  pastorForm: FormGroup;

  // Mat-Table properties
  displayedColumns: string[] = [
    'name', 'phoneNumber', 'address', 'assignedHiyawMahider', 'status', 'actions'
  ];
  dataSource = new MatTableDataSource<Pastor>([]); // Initialize MatTableDataSource

  @ViewChild(MatPaginator) paginator!: MatPaginator; // Get reference to MatPaginator

  hiyawMahiders: HiyawMahider[] = []; // Use the HiyawMahider type
  isEditMode = false;
  currentPastorId: string | null = null;
  isLoading = false;
  searchTerm = '';
  statusOptions = ['Active', 'Inactive', 'On Leave'];
  initialLoadComplete = false; // To manage "No data" message display

  constructor(
    private fb: FormBuilder,
    private pastorService: PastorService,
    private hiyawMahiderService: HiyawMahiderService,
    private snackBar: MatSnackBar // Inject MatSnackBar
  ) {
    this.pastorForm = this.fb.group({
      name: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      address: ['', Validators.required],
      assignedHiyawMahider: ['', Validators.required],
      status: ['Active', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadPastors();
    this.loadHiyawMahiders();
  }

  ngAfterViewInit(): void {
    // Connect the paginator to the MatTableDataSource after the view has initialized
    this.dataSource.paginator = this.paginator;
  }

  loadPastors(): void {
    this.isLoading = true;
    this.pastorService.getPastors(this.searchTerm).subscribe({
      next: (pastors) => {
        this.dataSource.data = pastors; // Assign data to MatTableDataSource
        if (this.paginator) {
          this.paginator.firstPage(); // Go to first page on new search/load
        }
        this.isLoading = false;
        this.initialLoadComplete = true; // Mark initial load as complete
      },
      error: (err) => {
        console.error('Error loading pastors:', err);
        this.snackBar.open('Failed to load pastors. Please try again.', 'Close', { duration: 3000 });
        this.isLoading = false;
        this.initialLoadComplete = true;
      }
    });
  }

  loadHiyawMahiders(): void {
    this.hiyawMahiderService.getHiyawMahiders().subscribe({
      next: (hiyawMahiders) => {
        this.hiyawMahiders = hiyawMahiders;
      },
      error: (err) => {
        console.error('Error loading Hiyaw Mahiders:', err);
        this.snackBar.open('Failed to load Hiyaw Mahiders for assignment.', 'Close', { duration: 3000 });
      }
    });
  }

  onSubmit(): void {
    if (this.pastorForm.invalid) {
      this.snackBar.open('Please fill in all required fields correctly.', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    const pastorData = this.pastorForm.value;

    if (this.isEditMode && this.currentPastorId) {
      this.pastorService.updatePastor(this.currentPastorId, pastorData).subscribe({
        next: () => {
          this.snackBar.open('Pastor updated successfully!', 'Close', { duration: 3000 });
          this.loadPastors();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error updating pastor:', err);
          this.snackBar.open('Failed to update pastor. Please try again.', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    } else {
      this.pastorService.createPastor(pastorData).subscribe({
        next: () => {
          this.snackBar.open('Pastor created successfully!', 'Close', { duration: 3000 });
          this.loadPastors();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error creating pastor:', err);
          this.snackBar.open('Failed to create pastor. Please try again.', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    }
  }

  onEdit(pastor: Pastor): void {
    this.isEditMode = true;
    this.currentPastorId = pastor.id ?? null;
    this.pastorForm.patchValue({
      name: pastor.name,
      phoneNumber: pastor.phoneNumber,
      address: pastor.address,
      assignedHiyawMahider: pastor.assignedHiyawMahider,
      status: pastor.status
    });
  }

  onDelete(id: string): void {
    if (!id) {
      this.snackBar.open('Pastor ID is missing.', 'Close', { duration: 3000 });
      return;
    }

    if (confirm('Are you sure you want to delete this pastor?')) {
      this.isLoading = true;
      this.pastorService.deletePastor(id).subscribe({
        next: () => {
          this.snackBar.open('Pastor deleted successfully!', 'Close', { duration: 3000 });
          this.loadPastors();
        },
        error: (err) => {
          console.error('Error deleting pastor:', err);
          this.snackBar.open('Failed to delete pastor. Please try again.', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
    }
  }

  resetForm(): void {
    this.pastorForm.reset({
      status: 'Active' // Reset to default status
    });
    this.isEditMode = false;
    this.currentPastorId = null;
    this.isLoading = false; // Ensure loading state is reset
  }

  onSearch(): void {
    // Mat-table's built-in filter is more efficient for client-side filtering
    // If your backend handles filtering, keep loadPastors().
    // For client-side, MatTableDataSource has a filter property.
    // Example: this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    this.loadPastors(); // Assuming loadPastors fetches filtered data from backend
  }

  getHiyawMahiderName(id: string | null): string { // Allow id to be null
    if (!id) return 'Not assigned';
    const hm = this.hiyawMahiders.find(h => h.id === id);
    return hm ? `${hm.name} (${hm.code})` : 'Not assigned';
  }

  getStatusClass(status: string): string {
    // This is still useful for custom styling based on status, e.g., text color
    switch (status.toLowerCase()) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'on leave': return 'status-on-leave'; // Changed 'on-hold' to 'on leave' to match your statusOptions
      default: return '';
    }
  }
}