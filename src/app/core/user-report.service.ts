import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  doc,
  getDocs,
  getDoc,
  CollectionReference,
  DocumentReference,
  Query,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

export interface TransformedUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  hiyawMahiderId: string;
  hiyawMahider?: string;
  status: string;
  createdAt: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserReportService {
  constructor(private firestore: Firestore) {}

  async getUsers(filters: any = {}): Promise<TransformedUser[]> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      let q = query(usersCollectionRef);
  
      // Status filter (using 'active' boolean field)
      if (filters.status) {
        q = query(q, where('active', '==', filters.status === 'Active'));
      }
  
      // Role filter
      if (filters.role) {
        q = query(q, where('role', '==', filters.role));
      }
  
      // Hiyaw Mahider filter
      if (filters.hiyawMahiderId && filters.hiyawMahiderId !== 'ALL') {
        q = query(q, where('assignedHiyawMahider', '==', filters.hiyawMahiderId));
      }
  
      // Date range filters
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        q = query(q, where('createdAt', '>=', startDate));
      }
  
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        q = query(q, where('createdAt', '<=', endDate));
      }
  
      const querySnapshot = await getDocs(q);
      
      const users = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as any;
        const id = docSnap.id;
  
        // Get Hiyaw Mahider name if needed
        let hiyawMahider = 'N/A';
        if (data.assignedHiyawMahider && data.assignedHiyawMahider !== 'N/A') {
          hiyawMahider = await this.getHiyawMahiderName(data.assignedHiyawMahider);
        }
  
        return {
          id,
          email: data.email || 'N/A',
          fullName: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A',
          phoneNumber: data.phoneNumber || data.contact || 'N/A',
          hiyawMahiderId: data.assignedHiyawMahider || 'N/A',
          hiyawMahider,
          role: data.role || 'N/A',
          status: data.active ? 'Active' : 'Inactive',
          createdAt: data.createdAt?.toDate() || null
        } as TransformedUser;
      }));
  
      return users;
  
    } catch (error) {
      console.error('Error loading users:', error);
      throw error;
    }
  }

  private determineUserStatus(data: any): string {
    // Check all possible status indicators
    if (data.active === true) return 'Active';
    if (data.active === false) return 'Inactive';
    if (data.status) return data.status === 'active' ? 'Active' : 'Inactive';
    if (data.isActive === true) return 'Active';
    if (data.isActive === false) return 'Inactive';
    
    // Default for users with no status field
    return 'Active'; // Or 'Unknown' if you prefer
  }
  
  private parseFirestoreDate(dateField: any): Date | null {
    if (!dateField) return null;
    try {
      return dateField.toDate ? dateField.toDate() : new Date(dateField);
    } catch (e) {
      console.error('Date parsing error:', e);
      return null;
    }
  }

  async getHiyawMahiderName(hiyawMahiderId: string): Promise<string> {
    if (hiyawMahiderId === 'N/A' || !hiyawMahiderId) {
      return 'N/A';
    }
    try {
      const hiyawMahidersCollectionRef: CollectionReference = collection(this.firestore, 'hiyawMahiders');
      const docRef: DocumentReference = doc(hiyawMahidersCollectionRef, hiyawMahiderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return (data as any).name || 'Unknown Hiyaw Mahider';
      }
      return 'N/A';
    } catch (error) {
      console.error('Error fetching Hiyaw Mahider name:', error);
      return 'Error fetching name';
    }
  }

  exportToCSV(data: TransformedUser[], filename: string) {
    if (!data || data.length === 0) {
      console.error('No data to export');
      return;
    }

    const csvRows = [];
    const headers = ['Email', 'Full Name', 'Phone Number', 'Hiyaw Mahider', 'Status', 'Created At'];
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = [
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${(row.fullName || '').replace(/"/g, '""')}"`,
        `"${(row.phoneNumber || '').replace(/"/g, '""')}"`,
        `"${(row.hiyawMahider || '').replace(/"/g, '""')}"`,
        `"${(row.status || '').replace(/"/g, '""')}"`,
        `"${(row.createdAt ? row.createdAt.toLocaleDateString() : 'N/A').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}