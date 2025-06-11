// user-report.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs/operators';
import { Query } from '@angular/fire/compat/firestore';


@Injectable({
  providedIn: 'root'
})
export class UserReportService {
  constructor(private firestore: AngularFirestore) {}

  getUsers(filters: any = {}) {
    return this.firestore.collection('users', ref => {
        let query: Query<any> = ref;

      if (filters.status) {
        query = query.where('isActive', '==', filters.status === 'Active');
      }
  
      if (filters.startDate) {
        query = query.where('createdAt', '>=', new Date(filters.startDate));
      }
  
      if (filters.endDate) {
        query = query.where('createdAt', '<=', new Date(filters.endDate));
      }
  
      return query;
    })
    .snapshotChanges()
    .pipe(
      map(actions => actions.map(a => {
        const data: any = a.payload.doc.data();
        const id = a.payload.doc.id;
        return { 
          id,
          username: data.username || data.email?.split('@')[0] || 'N/A',
          fullName: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A',
          contact: data.phoneNumber || data.contact || data.email || 'N/A',
          hiyawMahider: data.hiyawMahider || data.specialField || 'N/A',
          status: data.isActive ? 'Active' : 'Inactive',
          createdAt: data.createdAt
        };
      }))
    );
  }
 
  generateUserReport(users: any[]) {
    const report = {
      totalUsers: users.length,
      byStatus: {
        Active: users.filter(u => u.status === 'Active').length,
        Inactive: users.filter(u => u.status === 'Inactive').length
      },
      userList: users
    };

    return report;
  }

  exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) {
      console.error('No data to export');
      return;
    }

    const csvRows = [];
    // Headers
    const headers = ['Username', 'Full Name', 'Contact', 'Hiyaw Mahider', 'Status'];
    csvRows.push(headers.join(','));

    // Data
    for (const row of data) {
      const values = [
        `"${(row.username || '').replace(/"/g, '""')}"`,
        `"${(row.fullName || '').replace(/"/g, '""')}"`,
        `"${(row.contact || '').replace(/"/g, '""')}"`,
        `"${(row.hiyawMahider || '').replace(/"/g, '""')}"`,
        `"${(row.status || '').replace(/"/g, '""')}"`
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