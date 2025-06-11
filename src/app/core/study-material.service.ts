import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from '@angular/fire/storage';

import { Observable, from, switchMap } from 'rxjs';
import { StudyMaterial } from '../core/study-material.model';


@Injectable({
  providedIn: 'root'
})
export class StudyMaterialService {
  private collectionName = 'studyMaterials';

  constructor(
    private firestore: Firestore,
    private storage: Storage
  ) {}

  // Upload file to Firebase Storage and save metadata to Firestore
  uploadStudyMaterial(material: StudyMaterial, file: File): Observable<any> {
    const filePath = `study-materials/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, filePath);

    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => getDownloadURL(storageRef)),
      switchMap(url => {
        material.fileUrl = url;
        material.fileType = this.getFileType(file.name);
        material.uploadDate = new Date().toISOString();
        return from(this.addStudyMaterial(material));
      })
    );
  }

  // Add study material metadata to Firestore
  private async addStudyMaterial(material: StudyMaterial): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    await addDoc(colRef, material);
  }

  // Get all study materials
  getStudyMaterials(): Observable<StudyMaterial[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('uploadDate', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<StudyMaterial[]>;
  }

  // Delete study material
  deleteStudyMaterial(id: string, fileUrl: string): Observable<void> {
    const fileRef = ref(this.storage, fileUrl);
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);

    return from(deleteObject(fileRef)).pipe(
      switchMap(() => from(deleteDoc(docRef)))
    );
  }

  // Helper to determine file type
  private getFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    if (['pdf'].includes(extension || '')) return 'PDF';
    if (['doc', 'docx'].includes(extension || '')) return 'Word';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) return 'Video';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension || '')) return 'Image';

    return 'Other';
  }
}
