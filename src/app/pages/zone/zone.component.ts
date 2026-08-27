import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ZoneService } from '../../core/services/zone.service';
import { PastorService } from '../../core/services/pastor.service';
import { AuditLogService } from '../../core/services/audit-log.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Zone } from '../../core/models/zone.model';
import { Pastor } from '../../core/models/pastor.model';

@Component({
  selector: 'app-zone',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './zone.component.html',
  styleUrls: ['./zone.component.css']
})
export class ZoneComponent implements OnInit, OnDestroy {
  zones: Zone[] = [];
  pastors: Pastor[] = [];
  isLoading = true;
  isEditing = false;
  currentZoneId: string | null = null;

  searchTerm = '';
  currentStatusFilter: 'all' | 'active' | 'inactive' = 'all';

  zoneForm: FormGroup;

  displayedColumns: string[] = [
    'index',
    'code',
    'name',
    'mainCoordinators',
    'deputyCoordinators',
    'status',
    'actions'
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private zoneService: ZoneService,
    private pastorService: PastorService,
    private auditLogService: AuditLogService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.zoneForm = this.fb.group({
      code: ['', [
        Validators.required,
        Validators.maxLength(10),
        Validators.pattern(/^[a-zA-Z0-9-_\s]*$/)
      ]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      status: ['active', [Validators.required]],
      mainCoordinators: [[]],
      deputyCoordinators: [[]]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;

    this.pastorService.getPastors().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (pastors) => {
        this.pastors = pastors;
        this.loadZones();
      },
      error: (err) => {
        console.error('Failed to load pastors:', err);
        this.showError('Failed to load pastors');
        this.isLoading = false;
      }
    });
  }

  loadZones(): void {
    this.zoneService.getZones().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (zones) => {
        this.zones = zones;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load zones:', err);
        this.showError('Failed to load zones');
        this.isLoading = false;
      }
    });
  }

  startAdd(): void {
    this.isEditing = true;
    this.currentZoneId = null;
    this.zoneForm.reset({
      code: '',
      name: '',
      status: 'active',
      mainCoordinators: [],
      deputyCoordinators: []
    });
    this.zoneForm.markAsPristine();
    this.zoneForm.markAsUntouched();
  }

  startEdit(zone: Zone): void {
    this.isEditing = true;
    this.currentZoneId = zone.id;

    this.zoneForm.patchValue({
      code: zone.code,
      name: zone.name,
      status: zone.status,
      mainCoordinators: zone.mainCoordinators || [],
      deputyCoordinators: zone.deputyCoordinators || []
    });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.currentZoneId = null;
    this.zoneForm.reset();
  }

  saveZone(): void {
    this.zoneForm.markAllAsTouched();

    if (this.zoneForm.invalid) {
      this.showError('Please correct the form errors');
      return;
    }

    const formData = this.zoneForm.value;
    const isUpdate = !!this.currentZoneId;

    const operation = isUpdate
      ? this.zoneService.updateZone(this.currentZoneId!, formData)
      : this.zoneService.createZone(formData);

    operation.then(() => {
      const action = isUpdate ? 'ZONE_UPDATED' : 'ZONE_CREATED';
      this.auditLogService.log(action, 'Zone', this.currentZoneId || undefined, formData.name, formData);
      this.showSuccess(`Zone ${isUpdate ? 'updated' : 'created'} successfully`);
      this.cancelEdit();
      this.loadZones();
    })
      .catch(error => {
        console.error('Operation failed:', error);
        this.showError(`Failed to ${isUpdate ? 'update' : 'create'} zone: ${error.message}`);
      });
  }

  deleteZone(id: string): void {
    const zone = this.zones.find(z => z.id === id);
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Delete',
        message: `Are you sure you want to delete zone "${zone?.name || ''}"?`
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        this.zoneService.deleteZone(id).then(() => {
          this.auditLogService.log('ZONE_DELETED', 'Zone', id, zone?.name);
          this.showSuccess('Zone deleted successfully');
          this.loadZones();
        }).catch(error => {
          console.error('Failed to delete zone:', error);
          this.showError('Failed to delete zone');
        });
      }
    });
  }

  getCoordinatorNames(coordinatorIds: string[] | undefined): string {
    if (!coordinatorIds || coordinatorIds.length === 0) return 'None assigned';

    return coordinatorIds
      .map(id => {
        const pastor = this.pastors.find(p => p.id === id);
        return pastor ? pastor.name : 'Unknown';
      })
      .filter(name => name && name !== 'Unknown')
      .join(', ') || 'None assigned';
  }

  get filteredZones(): Zone[] {
    return this.zones.filter(zone => {
      const matchesStatus =
        this.currentStatusFilter === 'all'
          ? true
          : zone.status === this.currentStatusFilter;

      const search = this.searchTerm.toLowerCase().trim();
      const matchesSearch = !search
        ? true
        : zone.code.toLowerCase().includes(search) ||
          (zone.name && zone.name.toLowerCase().includes(search)) ||
          this.getCoordinatorNames(zone.mainCoordinators).toLowerCase().includes(search) ||
          this.getCoordinatorNames(zone.deputyCoordinators).toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }

  get activeCount(): number {
    return this.zones.filter(z => z.status === 'active').length;
  }

  get inactiveCount(): number {
    return this.zones.filter(z => z.status === 'inactive').length;
  }

  filterZones(status: 'all' | 'active' | 'inactive'): void {
    this.currentStatusFilter = status;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.currentStatusFilter = 'all';
  }

  toggleZoneStatus(zone: Zone): void {
    if (!zone.id) return;
    const newStatus = zone.status === 'active' ? 'inactive' : 'active';
    this.zoneService.updateZone(zone.id, { status: newStatus })
      .then(() => {
        zone.status = newStatus;
        this.auditLogService.log('ZONE_UPDATED', 'Zone', zone.id, zone.name, { status: newStatus });
        this.showSuccess(`Zone marked as ${newStatus}`);
      })
      .catch(err => {
        this.showError('Failed to update status: ' + err.message);
      });
  }

  get currentFilterLabel(): string {
    if (this.currentStatusFilter !== 'all') {
      return this.currentStatusFilter === 'active' ? 'Active Zones' : 'Inactive Zones';
    }
    return 'All Zones';
  }

  comparePastors(p1: any, p2: any): boolean {
    if (!p1 || !p2) return false;
    const p1Id = typeof p1 === 'object' ? p1.id : p1;
    const p2Id = typeof p2 === 'object' ? p2.id : p2;
    return p1Id === p2Id;
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }
}
