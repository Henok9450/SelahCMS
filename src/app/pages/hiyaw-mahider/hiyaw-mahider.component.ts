import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { PastorService } from '../../core/pastor.service';
import { ZoneService } from '../../core/zone.service';
import { HiyawMahider, HiyawMahiderStatus } from '../../core/hiyaw-mahider.model';
import { Pastor } from '../../core/pastor.model';
import { Zone } from '../../core/zone.model';
import { Observable, catchError, of, tap } from 'rxjs';
import { ToDatePipe } from '../../shared/pipes/to-date.pipe';

@Component({
  selector: 'app-hiyaw-mahider',
  standalone: true,
  imports: [CommonModule, FormsModule, ToDatePipe],
  templateUrl: './hiyaw-mahider.component.html',
  styleUrls: ['./hiyaw-mahider.component.css']
})
export class HiyawMahiderComponent implements OnInit {
  hiyawMahiders$!: Observable<HiyawMahider[]>;
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
  showAllResults = false;
  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  statusOptions: HiyawMahiderStatus[];

  // Pastor selection properties
  pastors: Pastor[] = [];
  filteredPastors: Pastor[] = [];
  filteredDeputyPastors: Pastor[] = [];
  showPastorDropdown = false;
  showDeputyPastorDropdown = false;
  pastorSearchTerm = '';
  deputyPastorSearchTerm = '';
  activePastorField: 'pastor' | 'deputyPastor' | 'editPastor' | 'editDeputyPastor' | null = null;

  // Zone properties
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

  // Get only active pastors
  getActivePastors(): Pastor[] {
    return this.pastors.filter(pastor => pastor.status === 'Active');
  }

  handlePastorInput(event: Event, field: 'pastor' | 'deputyPastor'): void {
    const inputElement = event.target as HTMLInputElement;
    if (field === 'pastor') {
      this.pastorSearchTerm = inputElement.value;
      this.filterPastors('pastor');
    } else {
      this.deputyPastorSearchTerm = inputElement.value;
      this.filterPastors('deputyPastor');
    }
  }

  getSafeDate(date: string | Date): Date {
    if (date instanceof Date) {
      return date;
    }
    return new Date(date);
  }

  loadPastors(): void {
    this.pastorService.getPastors().subscribe({
      next: (pastors) => {
        this.pastors = pastors;
        this.filteredPastors = this.getActivePastors();
        this.filteredDeputyPastors = this.getActivePastors();
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
    this.isLoading = true;
    this.errorMessage = null;
  
    const applyLimit = !this.hasActiveFilters() && !this.showAllResults;
    
    this.hiyawMahiders$ = this.hiyawMahiderService.searchHiyawMahiders({
      name: this.searchFilters.name,
      pastor: this.searchFilters.pastor,
      deputyPastor: this.searchFilters.deputyPastor,
      status: this.searchFilters.status || undefined,
      code: this.searchFilters.code,
      location: this.searchFilters.location,
      zone: this.searchFilters.zone || undefined
    }, applyLimit).pipe(
      tap(() => this.isLoading = false),
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = error.message;
        return of([]);
      })
    );
  }

  filterPastors(field: 'pastor' | 'deputyPastor'): void {
    const searchTerm = field === 'pastor' ? this.pastorSearchTerm : this.deputyPastorSearchTerm;
    const activePastors = this.getActivePastors();
    
    if (!searchTerm) {
      if (field === 'pastor') {
        this.filteredPastors = activePastors;
      } else {
        this.filteredDeputyPastors = activePastors;
      }
      return;
    }

    const filtered = activePastors.filter(pastor =>
      pastor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (field === 'pastor') {
      this.filteredPastors = filtered;
    } else {
      this.filteredDeputyPastors = filtered;
    }
  }

  selectPastor(pastor: Pastor, field: 'pastor' | 'deputyPastor' | 'editPastor' | 'editDeputyPastor'): void {
    if (!pastor) return;

    if (field.startsWith('edit')) {
      if (!this.editingItem) return;
      if (field === 'editPastor') {
        this.editingItem.pastor = pastor.name;
      } else {
        this.editingItem.deputyPastor = pastor.name;
      }
    } else {
      if (field === 'pastor') {
        this.newHiyawMahider.pastor = pastor.name;
      } else {
        this.newHiyawMahider.deputyPastor = pastor.name;
      }
    }

    this.closeDropdowns();
    this.clearSearchTerms();
  }

  toggleDropdown(field: 'pastor' | 'deputyPastor' | 'editPastor' | 'editDeputyPastor'): void {
    this.activePastorField = field;
    
    if (field === 'pastor' || field === 'editPastor') {
      this.showPastorDropdown = !this.showPastorDropdown;
      this.showDeputyPastorDropdown = false;
      if (this.showPastorDropdown) {
        this.filterPastors('pastor');
      }
    } else {
      this.showDeputyPastorDropdown = !this.showDeputyPastorDropdown;
      this.showPastorDropdown = false;
      if (this.showDeputyPastorDropdown) {
        this.filterPastors('deputyPastor');
      }
    }
  }

  closeDropdowns(): void {
    this.showPastorDropdown = false;
    this.showDeputyPastorDropdown = false;
    this.activePastorField = null;
  }

  clearSearchTerms(): void {
    this.pastorSearchTerm = '';
    this.deputyPastorSearchTerm = '';
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
      this.loadHiyawMahiders();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to create Hiyaw Mahider. Please try again.';
      console.error('Error creating Hiyaw Mahider:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.showAllResults = true;
    this.loadHiyawMahiders();
  }

  showAll(): void {
    this.showAllResults = true;
    this.loadHiyawMahiders();
  }

  resetForm(): void {
    this.newHiyawMahider = this.getDefaultHiyawMahider();
    this.codeError = null;
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
    this.showAllResults = false;
    this.loadHiyawMahiders();
  }

  private validateForm(): boolean {
    this.errorMessage = null;
    this.codeError = null;
    
    if (!this.newHiyawMahider.name.trim()) {
      this.errorMessage = 'Name is required';
      return false;
    }

    if (!this.newHiyawMahider.location.trim()) {
      this.errorMessage = 'Location is required';
      return false;
    }

    if (!this.newHiyawMahider.code.trim()) {
      this.codeError = 'Code is required';
      return false;
    }

    if (!/^[A-Za-z0-9\-_]+$/.test(this.newHiyawMahider.code)) {
      this.codeError = 'Code can only contain letters, numbers, hyphens and underscores';
      return false;
    }

    return true;
  }

  private getDefaultHiyawMahider(): Omit<HiyawMahider, 'id' | 'createdDate'> {
    return {
      name: '',
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
        this.loadHiyawMahiders();
      }).catch(error => {
        this.errorMessage = `Failed to delete Hiyaw Mahider "${name}". Please try again.`;
        console.error('Error deleting Hiyaw Mahider:', error);
      }).finally(() => {
        this.processingIds.delete(id);
      });
    }
  }

  startEdit(hm: HiyawMahider): void {
    this.editingItem = { ...hm };
    this.isEditMode = true;
    this.successMessage = null;
    this.errorMessage = null;
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.editingItem = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editingItem) return;

    if (!window.confirm(`Are you sure you want to update "${this.editingItem.name}"?`)) {
      return;
    }

    this.processingIds.add(this.editingItem.id);
    this.isLoading = true;
    this.errorMessage = null;
    
    try {
      const updatedItem = await this.hiyawMahiderService.updateHiyawMahider(
        this.editingItem.id, 
        {
          name: this.editingItem.name,
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
      this.loadHiyawMahiders();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to update Hiyaw Mahider';
      console.error('Error updating Hiyaw Mahider:', error);
    } finally {
      this.processingIds.delete(this.editingItem?.id || '');
      this.isLoading = false;
    }
  }
}