import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyMaterialService } from '../../core/services/study-material.service';
import { StudyMaterial } from '../../core/models/study-material.model';
import { Observable, first, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UploadMaterialDialogComponent } from '../../upload-material-dialog/upload-material-dialog.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HiyawMahiderService } from '../../core/services/hiyaw-mahider.service';
import { AuthService } from '../../core/services/auth.service';
import { AuditLogService } from '../../core/services/audit-log.service';
import { HiyawMahider } from '../../core/models/hiyaw-mahider.model';

@Component({
  selector: 'app-study-materials',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './study-materials.component.html',
  styleUrls: ['./study-materials.component.css']
})
export class StudyMaterialsComponent implements OnInit, OnDestroy {
  private materialService = inject(StudyMaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private hiyawMahiderService = inject(HiyawMahiderService);
  private authService = inject(AuthService);
  private auditLogService = inject(AuditLogService);

  materials$: Observable<StudyMaterial[]> = this.materialService.getStudyMaterials();
  loading = false;
  hiyawMahiders: string[] = [];
  isAdmin$ = this.authService.isAdmin$;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadHiyawMahiders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHiyawMahiders(): void {
    this.hiyawMahiderService.getHiyawMahiders().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (mahiders: HiyawMahider[]) => {
        this.hiyawMahiders = mahiders.map(hm => hm.name);
      },
      error: (err) => {
        console.error('Failed to load hiyaw mahiders:', err);
        this.snackBar.open('Error loading hiyaw mahiders', 'Close', { duration: 3000 });
      }
    });
  }

  openUploadDialog(): void {
    this.isAdmin$.pipe(first()).subscribe(isAdmin => {
      if (!isAdmin) {
        this.snackBar.open('You do not have permission to upload materials.', 'Close', { duration: 3000 });
        return;
      }

      const dialogRef = this.dialog.open(UploadMaterialDialogComponent, {
        width: '500px',
        data: {
          hiyawMahiders: this.hiyawMahiders
        }
      });

      dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
        if (result) {
          this.uploadMaterial(result.material, result.file);
        }
      });
    });
  }

  uploadMaterial(material: StudyMaterial, file: File): void {
    this.loading = true;
    this.materialService.uploadStudyMaterial(material, file).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.snackBar.open('Study material uploaded successfully!', 'Close', { duration: 3000 });
        this.auditLogService.log('STUDY_MATERIAL_UPLOADED', 'Study Material', undefined, material.title, {
          title: material.title,
          fileType: material.fileType,
          hiyawMahider: material.hiyawMahider
        });
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
    this.isAdmin$.pipe(first()).subscribe(isAdmin => {
      if (!isAdmin) {
        this.snackBar.open('You do not have permission to delete materials.', 'Close', { duration: 3000 });
        return;
      }

      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Confirm Delete',
          message: 'Are you sure you want to delete this study material?'
        }
      });

      dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(confirmed => {
        if (confirmed) {
          this.loading = true;
          this.materialService.deleteStudyMaterial(id, fileUrl).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: () => {
              this.snackBar.open('Study material deleted successfully!', 'Close', { duration: 3000 });
              this.auditLogService.log('STUDY_MATERIAL_DELETED', 'Study Material', id);
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
      });
    });
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
