import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PastorService } from '../../core/services/pastor.service';
import { HiyawMahiderService } from '../../core/services/hiyaw-mahider.service';
import { AuditLogService } from '../../core/services/audit-log.service';
import { Pastor } from '../../core/models/pastor.model';
import { HiyawMahider } from '../../core/models/hiyaw-mahider.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-pastor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatChipsModule
  ],
  templateUrl: './pastor.component.html',
  styleUrls: ['./pastor.component.css']
})
export class PastorComponent implements OnInit, AfterViewInit, OnDestroy {
  pastorForm: FormGroup;

  displayedColumns: string[] = [
    'name', 'phoneNumber', 'address', 'assignedHiyawMahider', 'role', 'status', 'actions'
  ];
  dataSource = new MatTableDataSource<Pastor>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  hiyawMahiders: HiyawMahider[] = [];
  isAdding = false;
  isEditMode = false;
  currentPastorId: string | null = null;
  editingPastor: Pastor | null = null;
  isLoading = false;
  searchTerm = '';
  statusOptions = ['Active', 'Inactive', 'On Hold'];
  initialLoadComplete = false;

  allPastors: Pastor[] = [];
  currentStatusFilter: 'all' | 'Active' | 'Inactive' | 'On Hold' = 'all';

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private pastorService: PastorService,
    private hiyawMahiderService: HiyawMahiderService,
    private auditLogService: AuditLogService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.pastorForm = this.fb.group({
      name: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      address: ['', Validators.required],
      assignedHiyawMahider: ['', Validators.required],
      role: ['Pastor', Validators.required],
      status: ['Active', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadPastors();
    this.loadHiyawMahiders();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPastors(): void {
    this.isLoading = true;
    this.pastorService.getPastors(this.searchTerm).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (pastors) => {
        this.allPastors = pastors;
        this.applyFilter();
        this.isLoading = false;
        this.initialLoadComplete = true;
      },
      error: (err) => {
        console.error('Error loading pastors:', err);
        this.snackBar.open('Failed to load pastors. Please try again.', 'Close', { duration: 3000 });
        this.isLoading = false;
        this.initialLoadComplete = true;
      }
    });
  }

  applyFilter(): void {
    if (this.currentStatusFilter === 'all') {
      this.dataSource.data = this.allPastors;
    } else {
      this.dataSource.data = this.allPastors.filter(p => p.status === this.currentStatusFilter);
    }
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  filterPastors(status: 'all' | 'Active' | 'Inactive' | 'On Hold'): void {
    this.currentStatusFilter = status;
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.currentStatusFilter = 'all';
    this.loadPastors();
  }

  get activeCount(): number {
    return this.allPastors.filter(p => p.status === 'Active').length;
  }

  get inactiveCount(): number {
    return this.allPastors.filter(p => p.status === 'Inactive').length;
  }

  get onHoldCount(): number {
    return this.allPastors.filter(p => p.status === 'On Hold').length;
  }

  get currentFilterLabel(): string {
    if (this.currentStatusFilter !== 'all') {
      return `${this.currentStatusFilter} Pastors`;
    }
    return 'All Pastors';
  }

  togglePastorStatus(pastor: Pastor): void {
    if (!pastor.id) return;
    const newStatus = pastor.status === 'Active' ? 'Inactive' : 'Active';
    
    this.pastorService.updatePastor(pastor.id, { status: newStatus }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        pastor.status = newStatus;
        this.applyFilter();
        this.auditLogService.log('PASTOR_UPDATED', 'Pastor', pastor.id, pastor.name, { status: newStatus });
        this.snackBar.open(`Pastor marked as ${newStatus}`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to update status:', err);
        this.snackBar.open('Failed to update status', 'Close', { duration: 3000 });
      }
    });
  }

  loadHiyawMahiders(): void {
    this.hiyawMahiderService.getHiyawMahiders().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
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

    if (this.isEditMode && this.currentPastorId && this.editingPastor) {
      const oldPastor = this.editingPastor;
      this.pastorService.updatePastor(this.currentPastorId, pastorData).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.snackBar.open('Pastor updated successfully!', 'Close', { duration: 3000 });
          this.auditLogService.log('PASTOR_UPDATED', 'Pastor', this.currentPastorId!, pastorData.name, pastorData);

          const isHiyawMahiderChanged = oldPastor.assignedHiyawMahider !== pastorData.assignedHiyawMahider;
          const isRoleChanged = oldPastor.role !== pastorData.role;
          const isNameChanged = oldPastor.name !== pastorData.name;

          if (isHiyawMahiderChanged || isRoleChanged || isNameChanged) {
            if (oldPastor.assignedHiyawMahider) {
              const oldField = oldPastor.role === 'Pastor' ? 'pastor' : 'deputyPastor';
              this.hiyawMahiderService.getHiyawMahiderById(oldPastor.assignedHiyawMahider).then(hm => {
                if (hm && hm[oldField] === oldPastor.name) {
                  this.hiyawMahiderService.updateHiyawMahider(oldPastor.assignedHiyawMahider, {
                    [oldField]: null
                  });
                }
              }).catch(err => console.error('Failed to clear old Hiyaw Mahider assignment:', err));
            }

            if (pastorData.assignedHiyawMahider) {
              const newField = pastorData.role === 'Pastor' ? 'pastor' : 'deputyPastor';
              this.hiyawMahiderService.updateHiyawMahider(pastorData.assignedHiyawMahider, {
                [newField]: pastorData.name
              }).catch(err => console.error('Failed to update new Hiyaw Mahider assignment:', err));
            }
          } else {
            if (pastorData.assignedHiyawMahider) {
              const currentField = pastorData.role === 'Pastor' ? 'pastor' : 'deputyPastor';
              this.hiyawMahiderService.updateHiyawMahider(pastorData.assignedHiyawMahider, {
                [currentField]: pastorData.name
              }).catch(err => console.error('Failed to sync Hiyaw Mahider assignment:', err));
            }
          }

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
      this.pastorService.createPastor(pastorData).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (docRef) => {
          this.snackBar.open('Pastor created successfully!', 'Close', { duration: 3000 });
          this.auditLogService.log('PASTOR_CREATED', 'Pastor', docRef.id, pastorData.name, pastorData);

          if (pastorData.assignedHiyawMahider) {
            const fieldToUpdate = pastorData.role === 'Pastor' ? 'pastor' : 'deputyPastor';
            this.hiyawMahiderService.updateHiyawMahider(pastorData.assignedHiyawMahider, {
              [fieldToUpdate]: pastorData.name
            }).catch(err => console.error('Failed to sync Hiyaw Mahider:', err));
          }

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

  startAdd(): void {
    this.isAdding = true;
    this.isEditMode = false;
    this.pastorForm.reset({
      status: 'Active',
      role: 'Pastor'
    });
  }

  cancelAdd(): void {
    this.isAdding = false;
    this.resetForm();
  }

  onEdit(pastor: Pastor): void {
    this.isEditMode = true;
    this.isAdding = false;
    this.currentPastorId = pastor.id ?? null;
    this.editingPastor = pastor;
    this.pastorForm.patchValue({
      name: pastor.name,
      phoneNumber: pastor.phoneNumber,
      address: pastor.address,
      assignedHiyawMahider: pastor.assignedHiyawMahider,
      role: pastor.role,
      status: pastor.status
    });
  }

  onDelete(id: string): void {
    if (!id) {
      this.snackBar.open('Pastor ID is missing.', 'Close', { duration: 3000 });
      return;
    }

    const pastor = this.dataSource.data.find(p => p.id === id);
    if (!pastor) {
      this.snackBar.open('Pastor not found.', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Pastor',
        message: `Are you sure you want to delete pastor "${pastor.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed) => {
      if (confirmed) {
        this.isLoading = true;
        this.pastorService.deletePastor(id).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.snackBar.open('Pastor deleted successfully!', 'Close', { duration: 3000 });
            this.auditLogService.log('PASTOR_DELETED', 'Pastor', id, pastor.name);

            if (pastor.assignedHiyawMahider) {
              const fieldToClear = pastor.role === 'Pastor' ? 'pastor' : 'deputyPastor';
              this.hiyawMahiderService.getHiyawMahiderById(pastor.assignedHiyawMahider).then(hm => {
                if (hm && hm[fieldToClear] === pastor.name) {
                  this.hiyawMahiderService.updateHiyawMahider(pastor.assignedHiyawMahider, {
                    [fieldToClear]: null
                  });
                }
              }).catch(err => console.error('Failed to clear Hiyaw Mahider assignment on deletion:', err));
            }

            this.loadPastors();
          },
          error: (err) => {
            console.error('Error deleting pastor:', err);
            this.snackBar.open('Failed to delete pastor. Please try again.', 'Close', { duration: 3000 });
            this.isLoading = false;
          }
        });
      }
    });
  }

  resetForm(): void {
    this.pastorForm.reset({
      status: 'Active',
      role: 'Pastor'
    });
    this.isEditMode = false;
    this.isAdding = false;
    this.currentPastorId = null;
    this.editingPastor = null;
    this.isLoading = false;
  }

  onSearch(): void {
    this.loadPastors();
  }

  getHiyawMahiderName(id: string | null): string {
    if (!id) return 'Not assigned';
    const hm = this.hiyawMahiders.find(h => h.id === id);
    return hm ? `${hm.name} (${hm.code})` : 'Not assigned';
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'on leave': return 'status-on-leave';
      case 'on hold': return 'status-on-hold';
      default: return '';
    }
  }
}
