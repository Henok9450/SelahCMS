import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyMaterialService } from '../../core/study-material.service';
import { StudyMaterial } from '../../core/study-material.model';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { UploadMaterialDialogComponent } from '../../upload-material-dialog/upload-material-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { HiyawMahider } from '../../core/hiyaw-mahider.model';

@Component({
  selector: 'app-study-materials',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './study-materials.component.html',
  styleUrls: ['./study-materials.component.css']
})
export class StudyMaterialsComponent {
  private materialService = inject(StudyMaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private hiyawMahiderService = inject(HiyawMahiderService);

  materials$: Observable<StudyMaterial[]> = this.materialService.getStudyMaterials();
  loading = false;
  hiyawMahiders: string[] = []; // Keep this declaration

  ngOnInit() {
    this.loadHiyawMahiders();
  }

  loadHiyawMahiders(): void {
    this.hiyawMahiderService.getHiyawMahiders().subscribe({
      next: (mahiders: HiyawMahider[]) => {
        this.hiyawMahiders = mahiders.map(hm => hm.name); // Extract names
      },
      error: (err) => {
        console.error('Failed to load hiyaw mahiders:', err);
        this.snackBar.open('Error loading hiyaw mahiders', 'Close', { duration: 3000 });
      }
    });
  }

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(UploadMaterialDialogComponent, {
      width: '500px',
      data: { 
        hiyawMahiders: this.hiyawMahiders 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.uploadMaterial(result.material, result.file);
      }
    });
  }

  uploadMaterial(material: StudyMaterial, file: File): void {
    this.loading = true;
    this.materialService.uploadStudyMaterial(material, file).subscribe({
      next: () => {
        this.snackBar.open('Study material uploaded successfully!', 'Close', { duration: 3000 });
        this.materials$ = this.materialService.getStudyMaterials();
        this.loading = false;
      },
      error: (err) => {
        console.error('Upload error:', err);
        this.snackBar.open('Error uploading material. Please try again.', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  
  deleteMaterial(id: string, fileUrl: string): void {
    if (confirm('Are you sure you want to delete this study material?')) {
      this.loading = true;
      this.materialService.deleteStudyMaterial(id, fileUrl).subscribe({
        next: () => {
          this.snackBar.open('Study material deleted successfully!', 'Close', { duration: 3000 });
          this.materials$ = this.materialService.getStudyMaterials();
          this.loading = false;
        },
        error: (err) => {
          console.error('Delete error:', err);
          this.snackBar.open('Error deleting material. Please try again.', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
    }
  }

  getFileIcon(type: string): string {
    switch (type) {
      case 'PDF': return 'picture_as_pdf';
      case 'Word': return 'description';
      case 'Video': return 'videocam';
      case 'Image': return 'image';
      default: return 'insert_drive_file';
    }
  }
}