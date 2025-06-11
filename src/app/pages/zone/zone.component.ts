import { Component, OnInit } from '@angular/core';
import { ZoneService } from '../../core/zone.service';
import { PastorService } from '../../core/pastor.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
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

import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Zone } from '../../core/zone.model';
import { Pastor } from '../../core/pastor.model';

@Component({
  selector: 'app-zone',
  standalone: true,
  imports: [
    CommonModule,
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
    MatSnackBarModule
  ],
  templateUrl: './zone.component.html',
  styleUrls: ['./zone.component.css']
})
export class ZoneComponent implements OnInit {
  zones: Zone[] = [];
  pastors: Pastor[] = [];
  isLoading = true;
  isEditing = false;
  currentZoneId: string | null = null;

  zoneForm: FormGroup;

  displayedColumns: string[] = ['code', 'name', 'status', 'coordinators', 'actions'];

  constructor(
    private zoneService: ZoneService,
    private pastorService: PastorService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Replace the form initialization in the constructor with this:
this.zoneForm = this.fb.group({
  code: ['', [
    Validators.required,
    Validators.maxLength(10),
    Validators.pattern(/^[a-zA-Z0-9-_\s]*$/)  // More permissive pattern
  ]],
  name: ['', [Validators.maxLength(100)]],
  status: ['active', [Validators.required]],
  coordinators: [[]] // Remove any unnecessary validators here
});

// Add this debug code right after form initialization:
this.zoneForm.valueChanges.subscribe(val => {
  console.log('FORM VALUE:', val);
  console.log('FORM VALID:', this.zoneForm.valid);
  console.log('FORM ERRORS:', this.zoneForm.errors);
  Object.keys(this.zoneForm.controls).forEach(key => {
    const control = this.zoneForm.get(key);
    console.log(`${key} valid: ${control?.valid}, errors:`, control?.errors);
  });
});

    // Debug form changes
    this.zoneForm.valueChanges.subscribe(values => {
      console.log('Form values:', values);
    });
    this.zoneForm.statusChanges.subscribe(status => {
      console.log('Form status:', status);
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    
    this.pastorService.getPastors().subscribe({
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
    this.zoneService.getZones().subscribe({
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
      coordinators: []
    });
    this.zoneForm.markAsPristine();
    this.zoneForm.markAsUntouched();
  }

  startEdit(zone: Zone): void {
    this.isEditing = true;
    this.currentZoneId = zone.id;

    const coordinators = zone.coordinators || [];

    this.zoneForm.patchValue({
      code: zone.code,
      name: zone.name,
      status: zone.status,
      coordinators: coordinators
    });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.currentZoneId = null;
    this.zoneForm.reset();
  }

  saveZone(): void {

    // Mark all fields as touched to show validation messages
    this.zoneForm.markAllAsTouched();

    if (this.zoneForm.invalid) {
      this.showFormErrors();
      this.showError('Please correct the form errors');
      return;
    }

    const formData = this.zoneForm.value;
    console.log('Saving zone data:', formData);

    const operation = this.currentZoneId
      ? this.zoneService.updateZone(this.currentZoneId, formData)
      : this.zoneService.createZone(formData);

    operation.then(() => {
      this.showSuccess(`Zone ${this.currentZoneId ? 'updated' : 'created'} successfully`);
      this.cancelEdit();
      this.loadZones();
    })
    .catch(error => {
      console.error('Operation failed:', error);
      this.showError(`Failed to ${this.currentZoneId ? 'update' : 'create'} zone: ${error.message}`);
    });
  }

  deleteZone(id: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this zone?'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.zoneService.deleteZone(id).then(() => {
          this.showSuccess('Zone deleted successfully');
          this.loadZones();
        }).catch(error => {
          console.error('Failed to delete zone:', error);
          this.showError('Failed to delete zone');
        });
      }
    });
  }

  getCoordinatorNames(coordinators: string[]): string {
    if (!coordinators || !coordinators.length) return 'None assigned';
  
    return coordinators
      .map(id => {
        const pastor = this.pastors.find(p => p.id === id);
        return pastor ? pastor.name : 'Unknown'; // Use pastor.name instead of firstName and lastName
      })
      .filter(name => name && name !== 'Unknown')
      .join(', ') || 'None assigned';
  }

  comparePastors(p1: any, p2: any): boolean {
    if (!p1 || !p2) return false;
    const p1Id = p1.id || p1;
    const p2Id = p2.id || p2;
    return p1Id === p2Id;
  }

  private showFormErrors(): void {
    Object.keys(this.zoneForm.controls).forEach(key => {
      const control = this.zoneForm.get(key);
      if (control?.errors) {
        console.log(`Control ${key} has errors:`, control.errors);
      }
    });
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