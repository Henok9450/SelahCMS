import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PastorService } from '../../core/pastor.service';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { Pastor } from '../../core/pastor.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';


@Component({
  selector: 'app-pastor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './pastor.component.html',
  styleUrls: ['./pastor.component.css']
})
export class PastorComponent implements OnInit {
  pastorForm: FormGroup;
  pastors: Pastor[] = [];
  hiyawMahiders: any[] = [];
  isEditMode = false;
  currentPastorId: string | null = null;
  isLoading = false;
  searchTerm = '';
  statusOptions = ['Active', 'Inactive', 'On Leave'];

  constructor(
    private fb: FormBuilder,
    private pastorService: PastorService,
    private hiyawMahiderService: HiyawMahiderService
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

  loadPastors(): void {
    this.isLoading = true;
    this.pastorService.getPastors(this.searchTerm).subscribe({
      next: (pastors) => {
        this.pastors = pastors;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading pastors:', err);
        this.isLoading = false;
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
      }
    });
  }

  onSubmit(): void {
    if (this.pastorForm.invalid) return;

    this.isLoading = true;
    const pastorData = this.pastorForm.value;

    if (this.isEditMode && this.currentPastorId) {
      this.pastorService.updatePastor(this.currentPastorId, pastorData).subscribe({
        next: () => {
          this.loadPastors();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error updating pastor:', err);
          this.isLoading = false;
        }
      });
    } else {
      this.pastorService.createPastor(pastorData).subscribe({
        next: () => {
          this.loadPastors();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error creating pastor:', err);
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
    if (confirm('Are you sure you want to delete this pastor?')) {
      this.isLoading = true;
      this.pastorService.deletePastor(id).subscribe({
        next: () => {
          this.loadPastors();
        },
        error: (err) => {
          console.error('Error deleting pastor:', err);
          this.isLoading = false;
        }
      });
    }
  }

  resetForm(): void {
    this.pastorForm.reset({
      status: 'Active'
    });
    this.isEditMode = false;
    this.currentPastorId = null;
    this.isLoading = false;
  }

  onSearch(): void {
    this.loadPastors();
  }

  getHiyawMahiderName(id: string): string {
    const hm = this.hiyawMahiders.find(h => h.id === id);
    return hm ? `${hm.name} (${hm.code})` : 'Not assigned';
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active': return 'status-badge active';
      case 'inactive': return 'status-badge inactive';
      case 'on-hold': return 'status-badge on-hold';
      default: return 'status-badge';
    }
  }
  
}