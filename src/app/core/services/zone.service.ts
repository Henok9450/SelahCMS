import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Zone } from '../models/zone.model';

@Injectable({
  providedIn: 'root'
})
export class ZoneService {
  private readonly collectionName = 'zones';

  constructor(private firestore: Firestore) {}

  createZone(zoneData: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    return addDoc(colRef, {
      ...zoneData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).then(() => {});
  }

  getZones(): Observable<Zone[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }) as Observable<Zone[]>;
  }

  updateZone(id: string, data: Partial<Zone>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  deleteZone(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(docRef);
  }
}
