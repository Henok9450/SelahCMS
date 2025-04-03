import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { User } from '../core/user.model';
import { Firestore, collection, doc, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private afs: AngularFirestore) {}

  // Get single user document
  getUser(uid: string): Observable<User | undefined> {
    return this.afs.collection('users').doc<User>(uid).valueChanges();
  }

  // Get all users (added to match UserManagementComponent requirements)
  getUsers(): Observable<User[]> {
    return this.afs.collection<User>('users').valueChanges({ idField: 'uid' });
  }

  // Get users by Hiyaw Mahider ID
  getUsersByHiyawMahider(hiyawMahiderId: string): Observable<User[]> {
    return this.afs.collection<User>('users', ref => 
      ref.where('hiyawMahiderId', '==', hiyawMahiderId)
    ).valueChanges({ idField: 'uid' });
  }

  // Get users by Zone ID
  getUsersByZone(zoneId: string): Observable<User[]> {
    return this.afs.collection<User>('users', ref => 
      ref.where('zoneId', '==', zoneId)
    ).valueChanges({ idField: 'uid' });
  }

  // Create new user
  createUser(user: User): Promise<void> {
    return this.afs.collection('users').doc(user.uid).set(user);
  }

  // Update existing user
  updateUser(uid: string, data: Partial<User>): Promise<void> {
    return this.afs.collection('users').doc(uid).update(data);
  }

  // Delete user (admin only)
  deleteUser(uid: string): Promise<void> {
    return this.afs.collection('users').doc(uid).delete();
  }

  // Get users by specific role
  getUsersByRole(role: string): Observable<User[]> {
    return this.afs.collection<User>('users', ref => 
      ref.where('role', '==', role)
    ).valueChanges({ idField: 'uid' });
  }
}