import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HiyawMahider, HiyawMahiderStatus } from '../../../core/models/hiyaw-mahider.model';
import { Pastor } from '../../../core/models/pastor.model';
import { Zone } from '../../../core/models/zone.model';
import { HiyawMahiderService } from '../../../core/services/hiyaw-mahider.service';
import { AuditLogService } from '../../../core/services/audit-log.service';

export interface HiyawMahiderDialogData {
  mode: 'create' | 'edit';
  item?: Partial<HiyawMahider>;
  zones: Zone[];
  pastors: Pastor[];
}

@Component({
  selector: 'app-hiyaw-mahider-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-header">
      <div class="header-left">
        <mat-icon class="dialog-header-icon">{{ data.mode === 'edit' ? 'edit' : 'add_circle' }}</mat-icon>
        <div>
          <h2 mat-dialog-title>{{ data.mode === 'edit' ? 'Edit Hiyaw Mahider' : 'Create New Hiyaw Mahider' }}</h2>
          <span class="dialog-subtitle" *ngIf="data.mode === 'edit' && formItem.name">
            {{ formItem.name }} ({{ formItem.code }})
          </span>
          <span class="dialog-subtitle" *ngIf="data.mode === 'create'">
            Fill in the details to register a new group
          </span>
        </div>
      </div>
      <button mat-icon-button (click)="onCancel()" class="close-btn" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <!-- Error Alert -->
      <div *ngIf="errorMessage" class="alert-box alert-error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ errorMessage }}</span>
      </div>

      <form #hmForm="ngForm" (ngSubmit)="onSubmit()">
        <div class="form-grid">
          <!-- Code -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Code *</mat-label>
            <input
              matInput
              type="text"
              name="code"
              [(ngModel)]="formItem.code"
              required
              placeholder="e.g. HM-001"
              (input)="codeError = null"
            />
            <mat-icon matSuffix>qr_code</mat-icon>
            <mat-hint>Unique group code</mat-hint>
            <mat-error *ngIf="codeError">{{ codeError }}</mat-error>
          </mat-form-field>

          <!-- Name -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Name *</mat-label>
            <input
              matInput
              type="text"
              name="name"
              [(ngModel)]="formItem.name"
              required
              placeholder="Enter Hiyaw Mahider name"
            />
            <mat-icon matSuffix>badge</mat-icon>
          </mat-form-field>

          <!-- Location -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Location *</mat-label>
            <input
              matInput
              type="text"
              name="location"
              [(ngModel)]="formItem.location"
              required
              placeholder="e.g. Bole Sub-city"
            />
            <mat-icon matSuffix>place</mat-icon>
          </mat-form-field>

          <!-- Zone -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Zone</mat-label>
            <mat-select name="zone" [(ngModel)]="formItem.zone">
              <mat-option value="">-- None / Select Zone --</mat-option>
              <mat-option *ngFor="let zone of data.zones" [value]="zone.id">
                {{ zone.name }}
              </mat-option>
            </mat-select>
            <mat-icon matSuffix>map</mat-icon>
          </mat-form-field>

          <!-- Host Name -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Host Name *</mat-label>
            <input
              matInput
              type="text"
              name="HostName"
              [(ngModel)]="formItem.HostName"
              required
              placeholder="Full name of the host"
            />
            <mat-icon matSuffix>person</mat-icon>
          </mat-form-field>

          <!-- Host Contact Number -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Host Contact Number *</mat-label>
            <input
              matInput
              type="tel"
              name="HostContactNumber"
              [(ngModel)]="formItem.HostContactNumber"
              required
              placeholder="e.g. +251 91 123 4567"
            />
            <mat-icon matSuffix>phone</mat-icon>
          </mat-form-field>

          <!-- Pastor -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Pastor</mat-label>
            <input
              matInput
              type="text"
              name="pastor"
              [ngModel]="formItem.pastor || ''"
              (ngModelChange)="onPastorChange($event)"
              [matAutocomplete]="autoPastor"
              placeholder="Search or select pastor"
            />
            <mat-icon matSuffix>supervisor_account</mat-icon>
            <mat-autocomplete #autoPastor="matAutocomplete" (optionSelected)="selectPastor($event.option.value)">
              <mat-option *ngFor="let pastor of filteredPastors" [value]="pastor.name">
                {{ pastor.name }}
              </mat-option>
              <mat-option *ngIf="filteredPastors.length === 0" disabled>
                No active pastors found
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>

          <!-- Deputy Pastor -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Deputy Pastor</mat-label>
            <input
              matInput
              type="text"
              name="deputyPastor"
              [ngModel]="formItem.deputyPastor || ''"
              (ngModelChange)="onDeputyPastorChange($event)"
              [matAutocomplete]="autoDeputyPastor"
              placeholder="Search or select deputy pastor"
            />
            <mat-icon matSuffix>person_outline</mat-icon>
            <mat-autocomplete #autoDeputyPastor="matAutocomplete" (optionSelected)="selectDeputyPastor($event.option.value)">
              <mat-option *ngFor="let dp of filteredDeputyPastors" [value]="dp.name">
                {{ dp.name }}
              </mat-option>
              <mat-option *ngIf="filteredDeputyPastors.length === 0" disabled>
                No active pastors found
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>

          <!-- Study Day -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Study Day</mat-label>
            <mat-select name="studyDay" [(ngModel)]="formItem.studyDay">
              <mat-option [value]="null">-- Select day --</mat-option>
              <mat-option *ngFor="let day of daysOfWeek" [value]="day">
                {{ day }}
              </mat-option>
            </mat-select>
            <mat-icon matSuffix>calendar_today</mat-icon>
          </mat-form-field>

          <!-- Study Time -->
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Study Time</mat-label>
            <input
              matInput
              type="time"
              name="studyTime"
              [(ngModel)]="formItem.studyTime"
            />
            <mat-icon matSuffix>schedule</mat-icon>
          </mat-form-field>

          <!-- Status -->
          <mat-form-field appearance="outline" class="form-field full-row">
            <mat-label>Status</mat-label>
            <mat-select name="status" [(ngModel)]="formItem.status" required>
              <mat-option *ngFor="let status of statusOptions" [value]="status">
                {{ status }}
              </mat-option>
            </mat-select>
            <mat-icon matSuffix>toggle_on</mat-icon>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-actions">
      <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="isLoading" class="cancel-btn">
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        type="button"
        (click)="onSubmit()"
        [disabled]="isLoading || !isFormValid()"
        class="submit-btn"
      >
        <mat-spinner diameter="18" *ngIf="isLoading" class="submit-spinner"></mat-spinner>
        <mat-icon *ngIf="!isLoading">{{ data.mode === 'edit' ? 'save' : 'add' }}</mat-icon>
        <span>{{ isLoading ? (data.mode === 'edit' ? 'Saving...' : 'Creating...') : (data.mode === 'edit' ? 'Save Changes' : 'Create Hiyaw Mahider') }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      background: linear-gradient(135deg, var(--brand-primary, #00796b) 0%, var(--brand-primary-hover, #004d40) 100%);
      color: #fff;
      border-radius: 8px 8px 0 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .dialog-header-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--brand-accent, #f9a825);
    }

    .dialog-header h2[mat-dialog-title] {
      color: #fff;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.2;
      padding: 0;
    }

    .dialog-subtitle {
      display: block;
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.85);
      margin-top: 3px;
    }

    .close-btn {
      color: rgba(255, 255, 255, 0.85);
      transition: color 0.2s;
    }

    .close-btn:hover {
      color: #fff;
    }

    .dialog-content {
      padding: 24px !important;
      max-height: 70vh;
      overflow-y: auto;
      min-width: 320px;
    }

    .alert-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 18px;
      font-size: 0.9rem;
    }

    .alert-error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ffcdd2;
    }

    .alert-error mat-icon {
      color: #c62828;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
    }

    .form-field {
      width: 100%;
    }

    .full-row {
      grid-column: 1 / -1;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px !important;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      margin: 0;
      background: #fafafa;
      border-radius: 0 0 8px 8px;
    }

    .cancel-btn {
      min-width: 90px;
    }

    .submit-btn {
      min-width: 150px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .submit-spinner {
      margin-right: 6px;
      display: inline-block;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      .dialog-content {
        padding: 16px !important;
      }
    }
  `]
})
export class HiyawMahiderFormDialogComponent implements OnInit {
  formItem: Partial<HiyawMahider> = {
    name: '',
    code: '',
    location: '',
    status: 'Active',
    pastor: null,
    zone: '',
    deputyPastor: null,
    studyDay: null,
    studyTime: null,
    HostName: '',
    HostContactNumber: ''
  };

  daysOfWeek: string[] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  statusOptions: HiyawMahiderStatus[] = ['Active', 'Inactive', 'On Hold', 'Closed'];

  filteredPastors: Pastor[] = [];
  filteredDeputyPastors: Pastor[] = [];

  isLoading = false;
  errorMessage: string | null = null;
  codeError: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<HiyawMahiderFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HiyawMahiderDialogData,
    private hiyawMahiderService: HiyawMahiderService,
    private auditLogService: AuditLogService
  ) {}

  ngOnInit(): void {
    if (this.data.item) {
      this.formItem = { ...this.data.item };
    }
    this.filterPastors('');
    this.filterDeputyPastors('');
  }

  private getActivePastors(): Pastor[] {
    return (this.data.pastors || []).filter(p => p.status === 'Active');
  }

  filterPastors(term: string): void {
    const active = this.getActivePastors();
    if (!term || !term.trim()) {
      this.filteredPastors = active;
    } else {
      const lower = term.toLowerCase();
      this.filteredPastors = active.filter(p => p.name.toLowerCase().includes(lower));
    }
  }

  filterDeputyPastors(term: string): void {
    const active = this.getActivePastors();
    if (!term || !term.trim()) {
      this.filteredDeputyPastors = active;
    } else {
      const lower = term.toLowerCase();
      this.filteredDeputyPastors = active.filter(p => p.name.toLowerCase().includes(lower));
    }
  }

  onPastorChange(val: string): void {
    this.formItem.pastor = val || null;
    this.filterPastors(val || '');
  }

  onDeputyPastorChange(val: string): void {
    this.formItem.deputyPastor = val || null;
    this.filterDeputyPastors(val || '');
  }

  selectPastor(name: string): void {
    this.formItem.pastor = name;
  }

  selectDeputyPastor(name: string): void {
    this.formItem.deputyPastor = name;
  }

  isFormValid(): boolean {
    return !!(
      this.formItem.code?.trim() &&
      this.formItem.name?.trim() &&
      this.formItem.location?.trim() &&
      this.formItem.HostName?.trim() &&
      this.formItem.HostContactNumber?.trim()
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) {
      this.errorMessage = 'Please fill in all required fields (*).';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.codeError = null;

    const trimmedCode = (this.formItem.code || '').trim();
    const trimmedName = (this.formItem.name || '').trim();
    const trimmedLocation = (this.formItem.location || '').trim();

    try {
      if (this.data.mode === 'create') {
        // Uniqueness checks
        const codeExists = await this.hiyawMahiderService.isCodeExists(trimmedCode);
        if (codeExists) {
          this.codeError = 'This code is already in use';
          this.isLoading = false;
          return;
        }

        const nameLocationExists = await this.hiyawMahiderService.isHiyawMahiderExists(
          trimmedName,
          trimmedLocation
        );
        if (nameLocationExists) {
          this.errorMessage = 'A Hiyaw Mahider with this name and location already exists';
          this.isLoading = false;
          return;
        }

        const payload: Omit<HiyawMahider, 'id' | 'createdDate'> = {
          name: trimmedName,
          code: trimmedCode,
          location: trimmedLocation,
          status: this.formItem.status || 'Active',
          pastor: this.formItem.pastor || null,
          zone: this.formItem.zone || null,
          deputyPastor: this.formItem.deputyPastor || null,
          studyDay: this.formItem.studyDay || null,
          studyTime: this.formItem.studyTime || null,
          HostName: (this.formItem.HostName || '').trim(),
          HostContactNumber: (this.formItem.HostContactNumber || '').trim()
        };

        const created = await this.hiyawMahiderService.createHiyawMahider(payload);
        this.auditLogService.log('HIYAW_MAHIDER_CREATED', 'Hiyaw Mahider', created.id, created.name, created);

        this.dialogRef.close({
          success: true,
          mode: 'create',
          item: created,
          message: `Hiyaw Mahider "${created.name}" created successfully with code "${created.code}"`
        });
      } else {
        // Edit mode
        const itemId = this.formItem.id;
        if (!itemId) {
          throw new Error('Item ID missing for edit operation');
        }

        // Code uniqueness check (exclude current item)
        const codeExists = await this.hiyawMahiderService.isCodeExists(trimmedCode, itemId);
        if (codeExists) {
          this.codeError = 'This code is already in use by another Hiyaw Mahider';
          this.isLoading = false;
          return;
        }

        const updatePayload: Partial<HiyawMahider> = {
          name: trimmedName,
          code: trimmedCode,
          location: trimmedLocation,
          status: this.formItem.status || 'Active',
          pastor: this.formItem.pastor || null,
          zone: this.formItem.zone || null,
          deputyPastor: this.formItem.deputyPastor || null,
          studyDay: this.formItem.studyDay || null,
          studyTime: this.formItem.studyTime || null,
          HostName: (this.formItem.HostName || '').trim(),
          HostContactNumber: (this.formItem.HostContactNumber || '').trim()
        };

        const updated = await this.hiyawMahiderService.updateHiyawMahider(itemId, updatePayload);
        this.auditLogService.log('HIYAW_MAHIDER_UPDATED', 'Hiyaw Mahider', itemId, updated.name, updated);

        this.dialogRef.close({
          success: true,
          mode: 'edit',
          item: updated,
          message: `Hiyaw Mahider "${updated.name}" updated successfully`
        });
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      console.error('Error saving Hiyaw Mahider:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
