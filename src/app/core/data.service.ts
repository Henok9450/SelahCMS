import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  docData,
  addDoc, 
  updateDoc, 
  deleteDoc 
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private firestore: Firestore) {}

  // ========== CRUD Operations ========== //

  /**
   * Get all documents from a collection
   */
  getAll<T>(collectionName: string): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    return collectionData(collectionRef, { idField: 'id' }) as Observable<T[]>;
  }

  /**
   * Get a single document by ID
   */
  getOne<T>(collectionName: string, id: string): Observable<T> {
    const docRef = doc(this.firestore, `${collectionName}/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<T>;
  }

  /**
   * Add a new document
   */
  async add<T>(collectionName: string, data: T): Promise<string> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = await addDoc(collectionRef, data as any);
    return docRef.id;
  }

  /**
   * Update a document
   */
  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(this.firestore, `${collectionName}/${id}`);
    await updateDoc(docRef, data as any);
  }

  /**
   * Delete a document
   */
  async delete(collectionName: string, id: string): Promise<void> {
    const docRef = doc(this.firestore, `${collectionName}/${id}`);
    await deleteDoc(docRef);
  }
}