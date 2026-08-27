import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { Pastor } from '../models/pastor.model';

@Injectable({
  providedIn: 'root'
})
export class PastorService {
  private readonly collectionName = 'pastors';

  constructor(private firestore: Firestore) { }

  getPastors(searchTerm?: string): Observable<Pastor[]> {
    let q = query(
      collection(this.firestore, this.collectionName),
      orderBy('name')
    );

    if (searchTerm) {
      q = query(
        collection(this.firestore, this.collectionName),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      );
    }

    return collectionData(q, { idField: 'id' }) as Observable<Pastor[]>;
  }

  createPastor(pastor: Pastor): Observable<any> {
    const pastorsCollection = collection(this.firestore, this.collectionName);
    return from(addDoc(pastorsCollection, pastor));
  }

  updatePastor(id: string, pastor: Partial<Pastor>): Observable<void> {
    const pastorDoc = doc(this.firestore, this.collectionName, id);
    return from(updateDoc(pastorDoc, pastor));
  }

  deletePastor(id: string): Observable<void> {
    const pastorDoc = doc(this.firestore, this.collectionName, id);
    return from(deleteDoc(pastorDoc));
  }
}
