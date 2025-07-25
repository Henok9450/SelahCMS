import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  DocumentData,
  collectionData
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators'; // Import tap and catchError
import { User } from './user.model';
import { doc, getDocs, docData, QuerySnapshot } from '@angular/fire/firestore'; 

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  constructor(private firestore: Firestore) {}

  /**
   * Fetches all active members/users in the system.
   * This method is primarily intended for Admin roles.
   * @returns An Observable of an array of active User objects.
   */
  getAllActiveMembers(): Observable<User[]> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      const q = query(usersCollectionRef, where('active', '==', true));
      console.log('Fetching all active members');
      return collectionData(q, { idField: 'uid' }).pipe(
        map((documents: DocumentData[]) => {
          return documents.map(doc => ({
            uid: doc['uid'],
            fullName: doc['fullName'] || 'Unknown',
            phoneNumber: doc['phoneNumber'] || 'N/A',
            residencyLocation: doc['residencyLocation'] || 'N/A',
            maritalStatus: doc['maritalStatus'] || 'Single',
            role: doc['role'] || 'Member',
            assignedHiyawMahider: doc['assignedHiyawMahider'] || null,
            pastor: doc['pastor'] || '',
            deputyPastor: doc['deputyPastor'] || '',
            active: doc['active'] ?? true,
            firstLogin: doc['firstLogin'] ?? false,
            displayName: doc['displayName'] || '',
            emailVerified: doc['emailVerified'] ?? false,
            createdAt: doc['createdAt'] || new Date(),
            updatedAt: doc['updatedAt'] || new Date(),
          }));
        }),
        tap(users => console.log('Fetched active members:', users)),
        catchError(error => {
          console.error('Error in getAllActiveMembers:', error);
          return of([]);
        })
      ) as Observable<User[]>;
    } catch (error) {
      console.error('Exception in getAllActiveMembers:', error);
      return of([]);
    }
  }

  /**
   * Fetches active members belonging to a specific Hiyaw Mahider.
   * This method is used by Pastor, Deputy Pastor, and Member roles to see their group members.
   * @param hiyawMahiderId The ID of the Hiyaw Mahider to filter members by.
   * @returns An Observable of an array of active User objects within the specified Hiyaw Mahider.
   */
  getMembersInAssignedHiyawMahider(hiyawMahiderId: string): Observable<User[]> {
    if (!hiyawMahiderId) {
      console.warn('getMembersInAssignedHiyawMahider called with null or empty hiyawMahiderId. Returning empty list.');
      return of([]);
    }

    const usersCollectionRef = collection(this.firestore, 'users');
    const q = query(
      usersCollectionRef,
      where('assignedHiyawMahider', '==', hiyawMahiderId),
      where('active', '==', true)
    );

    return collectionData(q, { idField: 'uid' }) as Observable<User[]>;
  }

 
 getMemberCountByHiyawMahider(hiyawMahiderId: string): Observable<number> {
  const usersCollectionRef = collection(this.firestore, 'users'); // Use the collection() function
  const q = query(usersCollectionRef, where('assignedHiyawMahider', '==', hiyawMahiderId));

  return new Observable<number>((observer) => {
    getDocs(q)
      .then((querySnapshot) => {
        const count = querySnapshot.size; // Get the count of documents
        observer.next(count);
        observer.complete();
      })
      .catch((error) => {
        console.error('Error fetching member count:', error);
        observer.error(error);
      });
  });
}
}