import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HiyawMahiderService {
  constructor(private afs: AngularFirestore) {}

  getHiyawMahiders(): Observable<any[]> {
    return this.afs.collection('hiyaw_mahiders').valueChanges({ idField: 'id' });
  }
  getHiyawMahider(id: string): Observable<any> {
    return this.afs.doc(`hiyaw_mahiders/${id}`).valueChanges();
  }
}
