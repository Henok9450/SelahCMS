import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot 
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { User } from '../core/user.model'; 
import { getDoc } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';
import { docData } from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore'; 
import { Auth } from '@angular/fire/auth';
import { sendPasswordResetEmail } from '@angular/fire/auth';
import { createUserWithEmailAndPassword, signOut } from '@angular/fire/auth';


@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private firestore: Firestore, private auth: Auth) {}

  // This method is designed to be called AFTER a user is created in Firebase Authentication.
  // It takes the Firebase Auth UID as the first argument.
  async createOrUpdateUserProfile(uid: string, userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'userName'>): Promise<void> {
    if (!userData.fullName) {
      throw new Error('Full name is required to create or update a user profile.');
    }

   
    const userProfile: User = {
      uid: uid, // CRITICAL: Use the Firebase Auth UID as the Firestore document ID
      fullName: userData.fullName, 
      email: userData.email || '',
      phoneNumber: userData.phoneNumber || '',
      residencyLocation: userData.residencyLocation || '',
      maritalStatus: userData.maritalStatus || '',
      role: userData.role || 'Member',
      firstLogin: userData.firstLogin !== undefined ? userData.firstLogin : true,
      active: userData.active !== undefined ? userData.active : true,
      createdAt: new Date(), 
      updatedAt: new Date(), 
      assignedHiyawMahider: userData.assignedHiyawMahider || null,
      pastor: userData.pastor || '',
      deputyPastor: userData.deputyPastor || ''
    };

    const userRef = doc(this.firestore, 'users', uid);
    return setDoc(userRef, userProfile, { merge: true });
  }

  updateUser(userId: string, data: Partial<User>): Promise<void> {
    const userRef = doc(this.firestore, 'users', userId);
    return updateDoc(userRef, {
      ...data,
      updatedAt: new Date()
    });
  }

  getUsersWithDetails(): Observable<User[]> {
    return new Observable<User[]>(subscriber => {
      const unsubscribe = onSnapshot(
        collection(this.firestore, 'users'), 
        async (querySnapshot) => {
          const users = await Promise.all(
            querySnapshot.docs.map(async doc => {
              const userData = doc.data() as User;
              const user: User = {
                uid: doc.id,
                ...userData,
                hiyawMahiderName: 'None',
                pastorName: userData.pastor || 'Not assigned',
                deputyPastorName: userData.deputyPastor || 'Not assigned'
              };

              if (userData.assignedHiyawMahider) {
                try {
                  const hiyawMahider = await this.getHiyawMahiderDetails(userData.assignedHiyawMahider);
                  if (hiyawMahider) {
                    return {
                      ...user,
                      hiyawMahiderName: hiyawMahider.name || 'Unknown',
                      pastorName: hiyawMahider.pastor || user.pastorName,
                      deputyPastorName: hiyawMahider.deputyPastor || user.deputyPastorName
                    };
                  }
                } catch (error) {
                  console.error('Error fetching Hiyaw Mahider details:', error);
                  return {
                    ...user,
                    hiyawMahiderName: 'Error loading'
                  };
                }
              }
              return user;
            })
          );
          subscriber.next(users);
        });

      return unsubscribe;
    });
  }

  private async getHiyawMahiderDetails(id: string): Promise<any> {
    const docRef = doc(this.firestore, 'hiyawMahiders', id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  }

  getPastorsForHiyawMahider(hiyawMahiderId: string): Observable<{pastor: string, deputyPastor: string}> {
    return new Observable(subscriber => {
      const hiyawMahiderRef = doc(this.firestore, 'hiyawMahiders', hiyawMahiderId);
      const unsubscribe = onSnapshot(hiyawMahiderRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          subscriber.next({
            pastor: data?.['pastor'] || '',
            deputyPastor: data?.['deputyPastor'] || ''
          });
        }
      });
      return unsubscribe;
    });
  }

  getUsersByRole(role: string): Observable<User[]> {
    return new Observable(subscriber => {
      const usersCollection = collection(this.firestore, 'users');
      const q = query(usersCollection, where('role', '==', role));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as User
        }));
        subscriber.next(users);
      });
      return unsubscribe;
    });
  }

  getUser(uid: string): Observable<User | null> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return docData(userRef, { idField: 'id' }) as Observable<User | null>;
  }

  getUserByEmail(email: string): Observable<User | null> {
    const usersCollection = collection(this.firestore, 'users');
    const q = query(usersCollection, where('email', '==', email));
    return collectionData(q, { idField: 'id' }).pipe(
      map(users => users.length > 0 ? users[0] as User : null)
    );
  }

  async resetUserPasswordByEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      console.log('Password reset email sent!');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }
}