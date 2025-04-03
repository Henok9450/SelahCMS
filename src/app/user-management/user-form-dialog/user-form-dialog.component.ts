// src/app/user-management/user-form-dialog/user-form-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { User } from '../../core//user.model';

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
  styleUrls: ['./user-form-dialog.component.css']
})
export class UserFormDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      user: User | null,
      currentUserRole: string,
      hiyawMahiders: any[],
      zones: any[]
    }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }
}