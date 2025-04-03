import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ZoneService {
  constructor(private afs: AngularFirestore) {}

  getZones(): Observable<any[]> {
    return this.afs.collection('zones').valueChanges({ idField: 'id' });
  }
}