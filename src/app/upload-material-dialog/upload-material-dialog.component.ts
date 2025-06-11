import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  MatDialogModule, 
  MatDialogRef, 
  MAT_DIALOG_DATA 
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { StudyMaterial } from '../core/study-material.model';
import { FileSizePipe } from '../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-upload-material-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    FileSizePipe,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './upload-material-dialog.component.html',
  styleUrls: ['./upload-material-dialog.component.css']
})
export class UploadMaterialDialogComponent {
  material: StudyMaterial = {
    title: '',
    description: '',
    fileUrl: '',
    fileType: '',
    author: '',
    category: '',
    hiyawMahider: ''
  };
  selectedFile: File | null = null;

  categories = ['Bible Study', 'Sermon', 'Devotional', 'Training', 'Other'];
  hiyawMahiders: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<UploadMaterialDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data?.hiyawMahiders) {
      this.hiyawMahiders = data.hiyawMahiders;
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      // Set default title to filename without extension if title is empty
      if (!this.material.title) {
        this.material.title = file.name.replace(/\.[^/.]+$/, "");
      }
    }
  }

  upload(): void {
    if (this.selectedFile && this.material.title) {
      this.dialogRef.close({ 
        material: this.material, 
        file: this.selectedFile 
      });
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}