import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, CollectionReference, DocumentData, Query, orderBy } from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { getDoc, doc } from '@angular/fire/firestore';

interface User {
  id: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  hiyawMahider: string;
  hiyawMahiderId?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  active?: boolean;
  contact?: string;
  firstName?: string;
  lastName?: string;
  assignedHiyawMahider?: string;
}

interface HiyawMahider {
    id: string;
    name: string;
  }

interface ReportData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  userList: User[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private hiyawMahiderCache = new Map<string, string>();

  constructor(private firestore: Firestore) {}

  getAvailableReports() {
    return [
      {
        id: 'user-management',
        title: 'User Management',
        icon: 'people',
        description: 'View and manage user accounts'
      },
      {
        id: 'attendance',
        title: 'Attendance Report',
        icon: 'how_to_reg',
        description: 'Member attendance reports'
      },
      {
        id: 'hiyaw-mahider',
        title: 'Hiyaw Mahider Reports',
        icon: 'diversity_3',
        description: 'Hiyaw Mahider statistics'
      },
      {
        id: 'follow-up',
        title: 'Follow-Up Reports',
        icon: 'warning_amber',
        description: 'Follow-up analytics'
      }
    ];
  }

  getUsers(filters: any = {}): Observable<User[]> {
    const usersCollection = collection(this.firestore, 'users');
    let q: Query<DocumentData> = query(usersCollection, orderBy('createdAt', 'desc'));

    if (filters.status) {
      q = query(q, where('active', '==', filters.status === 'Active'));
    }

    if (filters.role) {
      q = query(q, where('role', '==', filters.role));
    }

    if (filters.hiyawMahider) {
      q = query(q, where('assignedHiyawMahider', '==', filters.hiyawMahider));
    }

    if (filters.startDate) {
      q = query(q, where('createdAt', '>=', new Date(filters.startDate)));
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('createdAt', '<=', endDate));
    }

    return collectionData(q, { idField: 'id' }).pipe(
        map(users => {
          if (!users) return []; // Ensure we always return an array
          return users.map(user => this.transformUserData(user));
        }),
        tap(users => console.log('Processed users:', users))
      );
    }

  transformUserData(user: any): User {
    return {
      id: user.id || 'N/A',
      username: user.userName || user.username || user.email?.split('@')[0] || 'N/A',
      fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
      phoneNumber: user.phoneNumber || user.contact || 'N/A',
      role: user.role || 'N/A',
      hiyawMahider: user.assignedHiyawMahider || user.hiyawMahider || 'N/A',
      hiyawMahiderId: user.assignedHiyawMahider || user.hiyawMahider || '',
      status: (user.active === true || user.status === 'Active') ? 'Active' : 'Inactive',
      createdAt: this.formatDate(user.createdAt),
      contact: user.phoneNumber || user.contact || 'N/A'
    };
  }

  private formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    
    try {
      if (dateInput.toDate) {
        return dateInput.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
    
    return 'N/A';
  }

  generateUserReport(users: User[]): ReportData {
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'Active').length,
      inactiveUsers: users.filter(u => u.status === 'Inactive').length,
      userList: users
    };
  }

  // Add this method to your ReportService
  getHiyawMahiders(): Observable<HiyawMahider[]> {
    const hiyawMahidersCollection = collection(this.firestore, 'hiyawMahiders');
    const q = query(hiyawMahidersCollection, orderBy('name'));
  
    return collectionData(q, { idField: 'id' }).pipe(
      map((mahiders: DocumentData[]) =>
        mahiders.map((mahider: DocumentData) => ({
          id: mahider['id'], // Access properties using ['propertyName']
          name: mahider['name'] || 'Unnamed'
        }))
      )
    );
  }

  async getHiyawMahiderName(id: string): Promise<string> {
    if (!id) return 'N/A';
    
    if (this.hiyawMahiderCache.has(id)) {
      return this.hiyawMahiderCache.get(id)!;
    }

    try {
      const docRef = doc(this.firestore, `hiyawMahiders/${id}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const name = docSnap.data()['name'] || 'Unknown';
        this.hiyawMahiderCache.set(id, name);
        return name;
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error fetching Hiyaw Mahider:', error);
      return 'Error';
    }
  }

  exportToCSV(data: User[], filename: string) {
    if (!data || data.length === 0) {
      console.error('No data to export');
      return;
    }

    const csvRows = [];
    const headers = [
      'Username', 'Full Name', 'Phone Number', 'Status', 'Role',
      'Hiyaw Mahider', 'Created At'
    ];
    
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = [
        `"${(row.username || '').replace(/"/g, '""')}"`,
        `"${(row.fullName || '').replace(/"/g, '""')}"`,
        `"${(row.phoneNumber || '').replace(/"/g, '""')}"`,
        `"${(row.status || '').replace(/"/g, '""')}"`,
        `"${(row.role || '').replace(/"/g, '""')}"`,
        `"${(row.hiyawMahider || '').replace(/"/g, '""')}"`,
        `"${(row.createdAt || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    this.downloadFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  private downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}