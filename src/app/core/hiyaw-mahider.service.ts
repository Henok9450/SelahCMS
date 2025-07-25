import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  limit
} from '@angular/fire/firestore';
import { HiyawMahider, HiyawMahiderStatus } from '../core/hiyaw-mahider.model';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { docData } from '@angular/fire/firestore'; // Import docData
import { first } from 'rxjs/operators'; // Import first

@Injectable({
  providedIn: 'root'
})
export class HiyawMahiderService {
  private readonly collectionName = 'hiyawMahiders';

  constructor(private firestore: Firestore) {}

  private normalizeSearchTerm(term: string): string {
    return term.replace(/%/g, '').trim().toLowerCase();
  }

  async isHiyawMahiderExists(name: string, location: string, excludeId?: string): Promise<boolean> {
    const normalizedName = this.normalizeSearchTerm(name);
    const normalizedLocation = this.normalizeSearchTerm(location);
    
    let q = query(
      collection(this.firestore, this.collectionName),
      where('nameLower', '==', normalizedName),
      where('locationLower', '==', normalizedLocation)
    );

    const snapshot = await getDocs(q);
    
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return !snapshot.empty;
  }

  async isCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const normalizedCode = this.normalizeSearchTerm(code);
    let q = query(
      collection(this.firestore, this.collectionName),
      where('codeLower', '==', normalizedCode)
    );

    const snapshot = await getDocs(q);
    
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return !snapshot.empty;
  }

  async createHiyawMahider(hiyawMahider: Omit<HiyawMahider, 'id' | 'createdDate'>): Promise<HiyawMahider> {
    if (!hiyawMahider.code || !hiyawMahider.name || !hiyawMahider.location) {
      throw new Error('Code, name, and location are required');
    }

    const normalizedCode = this.normalizeSearchTerm(hiyawMahider.code);
    const codeExists = await this.isCodeExists(normalizedCode);
    if (codeExists) {
      throw new Error('This code is already in use');
    }

    const exists = await this.isHiyawMahiderExists(hiyawMahider.name, hiyawMahider.location);
    if (exists) {
      throw new Error('A Hiyaw Mahider with this name and location already exists');
    }

    const docRef = await addDoc(collection(this.firestore, this.collectionName), {
      ...hiyawMahider,
      hostName: hiyawMahider.HostName,  
    hostContactNumber: hiyawMahider.HostContactNumber,  
      nameLower: this.normalizeSearchTerm(hiyawMahider.name),
      locationLower: this.normalizeSearchTerm(hiyawMahider.location),
      codeLower: normalizedCode,
      pastorLower: hiyawMahider.pastor ? this.normalizeSearchTerm(hiyawMahider.pastor) : '',
      deputyPastorLower: hiyawMahider.deputyPastor ? this.normalizeSearchTerm(hiyawMahider.deputyPastor) : '',
      createdDate: new Date()
    });

    return {
      id: docRef.id,
      ...hiyawMahider,
      createdDate: new Date()
    };
  }
  async updateHiyawMahider(id: string, data: Partial<HiyawMahider>): Promise<HiyawMahider> {
    // Create a clean update object without undefined values
    const updateData: any = {};
  
    // Add only defined fields to the update object
    if (data.name !== undefined && data.name !== null) {
      updateData.name = data.name;
      updateData.nameLower = this.normalizeSearchTerm(data.name);
    }
    if (data.HostName !== undefined && data.HostName !== null) {
      updateData.HostName = data.HostName;  
    }
    if (data.HostContactNumber !== undefined && data.HostContactNumber !== null) {
      updateData.HostContactNumber = data.HostContactNumber;  
    }
    if (data.location !== undefined && data.location !== null) {
      updateData.location = data.location;
      updateData.locationLower = this.normalizeSearchTerm(data.location);
    }
    if (data.zone !== undefined && data.zone !== null) {
      updateData.zone = data.zone;
    }
    if (data.code !== undefined && data.code !== null) {
      updateData.code = data.code;
      updateData.codeLower = this.normalizeSearchTerm(data.code);
    }
    if (data.status !== undefined && data.status !== null) {
      updateData.status = data.status;
    }
    if (data.pastor !== undefined && data.pastor !== null) {
      updateData.pastor = data.pastor;
      updateData.pastorLower = data.pastor ? this.normalizeSearchTerm(data.pastor) : '';
    }
    if (data.deputyPastor !== undefined && data.deputyPastor !== null) {
      updateData.deputyPastor = data.deputyPastor;
      updateData.deputyPastorLower = data.deputyPastor ? this.normalizeSearchTerm(data.deputyPastor) : '';
    }
    if (data.studyDay !== undefined && data.studyDay !== null) {
      updateData.studyDay = data.studyDay;
    }
    if (data.studyTime !== undefined && data.studyTime !== null) {
      updateData.studyTime = data.studyTime;
    }
  
    // Check for duplicates only if name or location are being updated
    if (data.name !== undefined && data.location !== undefined) {
      const exists = await this.isHiyawMahiderExists(data.name, data.location, id);
      if (exists) {
        throw new Error('A Hiyaw Mahider with this name and location already exists');
      }
    }
  
    // Check for code uniqueness only if code is being updated
    if (data.code !== undefined) {
      const codeExists = await this.isCodeExists(data.code, id);
      if (codeExists) {
        throw new Error('This code is already in use by another Hiyaw Mahider');
      }
    }
  
    // Only update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      await updateDoc(doc(this.firestore, this.collectionName, id), updateData);
    }
  
    // Return the updated document
    const updatedDoc = await this.getHiyawMahiderById(id);
    if (!updatedDoc) {
      throw new Error('Failed to retrieve updated Hiyaw Mahider');
    }
    return updatedDoc;
  }
  async deleteHiyawMahider(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.collectionName, id));
  }

  searchHiyawMahiders(filters: {
    name?: string;
    pastor?: string;
    deputyPastor?: string;
    status?: HiyawMahiderStatus;
    code?: string;
    location?: string;
    zone?: string;
  }, applyLimit: boolean = false): Observable<HiyawMahider[]> {
    // Start with base query ordered by creation date
    let q = query(
      collection(this.firestore, this.collectionName),
      orderBy('createdDate', 'desc')
    );

     // Apply limit FIRST if needed
  if (applyLimit) {
    q = query(q, limit(4));
  }
  
    // Only apply filters if they have values
    if (filters.name && filters.name.trim()) {
      const normalized = this.normalizeSearchTerm(filters.name);
      q = query(
        q,
        where('nameLower', '>=', normalized),
        where('nameLower', '<=', normalized + '\uf8ff')
      );
    }
  
    if (filters.pastor && filters.pastor.trim()) {
      const normalized = this.normalizeSearchTerm(filters.pastor);
      q = query(
        q,
        where('pastorLower', '>=', normalized),
        where('pastorLower', '<=', normalized + '\uf8ff')
      );
    }
  
    if (filters.deputyPastor && filters.deputyPastor.trim()) {
      const normalized = this.normalizeSearchTerm(filters.deputyPastor);
      q = query(
        q,
        where('deputyPastorLower', '>=', normalized),
        where('deputyPastorLower', '<=', normalized + '\uf8ff')
      );
    }
  
    if (filters.location && filters.location.trim()) {
      const normalized = this.normalizeSearchTerm(filters.location);
      q = query(
        q,
        where('locationLower', '>=', normalized),
        where('locationLower', '<=', normalized + '\uf8ff')
      );
    }
  
    if (filters.code && filters.code.trim()) {
      const normalized = this.normalizeSearchTerm(filters.code);
      q = query(
        q,
        where('codeLower', '>=', normalized),
        where('codeLower', '<=', normalized + '\uf8ff')
      );
    }

    if (filters.zone) {
      q = query(q, where('zone', '==', filters.zone));
    }
  
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
  
  
  
    return collectionData(q, { idField: 'id' }).pipe(
      map((data: any[]) => data.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        location: d.location,
        zone: d.zone,
        status: d.status,
        HostName: d.HostName || '',  
      HostContactNumber: d.HostContactNumber || '', 
        pastor: d.pastor,
        deputyPastor: d.deputyPastor,
        studyDay: d.studyDay,
        studyTime: d.studyTime,
        createdDate: d.createdDate?.toDate()
      } as HiyawMahider))),
      catchError(error => {
        console.error('Search error:', error);
        throw error;
      })
    );
  }
  private hasActiveFilters(filters: any): boolean {
    return Object.values(filters).some(
      value => value !== undefined && value !== null && value !== ''
    );
  }

  getActiveHiyawMahiders(): Observable<HiyawMahider[]> {
    const collectionRef = collection(this.firestore, 'hiyawMahiders');
    const queryRef = query(
      collectionRef, 
      where('status', '==', 'Active') // Make sure this matches your document field exactly
    );
  
    return collectionData(queryRef, { idField: 'id' }).pipe(
      map((data: any[]) => {
        if (!data || data.length === 0) {
          console.warn('No active Hiyaw Mahiders found');
          return [];
        }
        return data.map(d => ({
          id: d.id, // This will be populated by the idField option
          name: d.name || 'Unnamed',
          code: d.code || '',
          location: d.location || '',
          zone: d.zone || '',
          status: d.status || '',
          pastor: d.pastor || '',
          hostName: d.HostName || '',
          hostContactNumber: d.HostContactNumber || '',
          deputyPastor: d.deputyPastor || '',
          studyDay: d.studyDay || '',
          studyTime: d.studyTime || '',
          createdDate: d.createdDate?.toDate() || null,
        } as HiyawMahider));
      }),
      catchError(error => {
        console.error('Error loading Hiyaw Mahiders:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  // Get all Hiyaw Mahiders
  getHiyawMahiders(): Observable<HiyawMahider[]> {
    const q = query(
      collection(this.firestore, this.collectionName),
      orderBy('createdDate', 'desc')
    );
  
    return collectionData(q, { idField: 'id' }).pipe(
      map((data: any[]) => data.map(d => ({
        id: d.id,
        name: d.name || 'Unnamed',
        code: d.code || '',
        location: d.location || '',
        zone: d.zone || '',
        status: d.status || '',
        pastor: d.pastor || '',
        deputyPastor: d.deputyPastor || '',
        studyDay: d.studyDay || '',
        studyTime: d.studyTime || '',
        createdDate: d.createdDate?.toDate() || null,
        HostName: d.HostName || '',  
      HostContactNumber: d.HostContactNumber || '',  
      } as HiyawMahider)))
    );
  }

  async getHiyawMahiderById(id: string): Promise<HiyawMahider | null> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const snapshot = await getDoc(docRef);
  
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    // Remove the lowercase fields from the returned data
    const {nameLower, locationLower, codeLower, pastorLower, deputyPastorLower, ...rest} = data;
    return {
      id: snapshot.id,
      ...rest
    } as HiyawMahider;
  }

  getStatusOptions(): HiyawMahiderStatus[] {
    return ['Active', 'Inactive', 'On Hold', 'Closed'];
  }

  getHiyawMahiderName(hiyawMahiderId: string): Observable<string> {
    if (!hiyawMahiderId) {
      return of(''); // Return empty string if no ID is provided
    }
    const hiyawMahiderDocRef = doc(this.firestore, `hiyawMahiders/${hiyawMahiderId}`);
    return docData(hiyawMahiderDocRef).pipe(
      first(), // Take only the first value and complete
      map(data => (data as any)?.name || ''), // Assume 'name' field exists
      catchError(error => {
        console.error(`Error fetching Hiyaw Mahider name for ID ${hiyawMahiderId}:`, error);
        return of(''); // Return empty string on error
      })
    );
  }
}