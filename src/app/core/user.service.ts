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
import { map, switchMap } from 'rxjs/operators';
import { docData } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private firestore: Firestore) {}

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!userData.fullName) {
      throw new Error('Full name is required to create a user.');
    }

    const userId = doc(collection(this.firestore, 'users')).id;
    const userName = await this.generateUniqueUsername(userData.fullName);

    const user: User = {
      id: userId,
      userName,
      fullName: userData.fullName, // Now guaranteed to exist
      phoneNumber: userData.phoneNumber || '',
      residencyLocation: userData.residencyLocation || '',
      maritalStatus: userData.maritalStatus || '',
      role: userData.role || 'Member',
      firstLogin: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedHiyawMahider: userData.assignedHiyawMahider || null,
      pastor: userData.pastor || '',
      deputyPastor: userData.deputyPastor || ''
    };

    const userRef = doc(this.firestore, 'users', userId);
    return setDoc(userRef, user);
}

  private getFirstName(fullName: string): string {
    // Get first name and clean it
    const firstName = fullName.split(' ')[0];
    return firstName.toLowerCase()
      .replace(/[^a-z]/g, '')  // Remove non-alphabets
      .substring(0, 8);        // Limit to 8 characters
  }

  private async generateUniqueUsername(fullName: string): Promise<string> {
    const baseName = this.getFirstName(fullName);
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
      const userName = `${baseName}.${suffix}`;

      const usersCollection = collection(this.firestore, 'users');
      const q = query(usersCollection, where('userName', '==', userName));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return userName;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique username after multiple attempts');
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
                id: doc.id,
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
}