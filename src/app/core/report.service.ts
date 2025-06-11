import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, CollectionReference, DocumentData, Query, orderBy } from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { getDoc, doc } from '@angular/fire/firestore';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
        id: 'zone',
        title: 'Zone Reports',
        icon: 'location_on',
        description: 'Zone-based analytics'
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
      map(users => users.map(user => this.transformUserData(user))),
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
  /**
   * Export attendance report to CSV
   */
  generateAttendanceReport(records: any[]): any {
    const summary = {
      total: records.length,
      present: records.filter(record => record.status === 'Present').length,
      absent: records.filter(record => record.status === 'Absent').length,
      late: records.filter(record => record.status === 'Late').length,
      excused: records.filter(record => record.status === 'Excused').length,
      attendanceRate: 0
    };
  
    summary.attendanceRate = summary.total > 0
      ? Math.round((summary.present / summary.total) * 100)
      : 0;
  
    const byUser = this.groupBy(records, 'userName');
    const byHiyawMahider = this.groupBy(records, 'hiyawMahiderId');
    const byZone = this.groupBy(records, 'zone');
    const byDate = this.groupBy(records, 'date');
  
    return {
      summary,
      byUser: this.calculateGroupStats(byUser),
      byHiyawMahider: this.calculateGroupStats(byHiyawMahider),
      byZone: this.calculateGroupStats(byZone),
      byDate: this.calculateGroupStats(byDate),
      records
    };
  }
  
  private groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((result, currentValue) => {
      const groupKey = currentValue[key] || 'N/A';
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(currentValue);
      return result;
    }, {});
  }
  
  private calculateGroupStats(groupedData: Record<string, any[]>): any[] {
    return Object.keys(groupedData).map(key => {
      const group = groupedData[key];
      const total = group.length;
      const present = group.filter(record => record.status === 'Present').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  
      return {
        key,
        total,
        present,
        rate
      };
    });
  }

  exportAttendanceReportToCSV(reportData: ReturnType<typeof this.generateAttendanceReport>, filename: string): void {
    const { summary, byUser, byHiyawMahider, byZone, byDate, records } = reportData;
  
    // Create CSV content
    let csvContent = 'Attendance Report\n\n';
  
    // Summary section
    csvContent += 'Summary\n';
    csvContent += `Total Records,${summary.total}\n`;
    csvContent += `Present,${summary.present}\n`;
    csvContent += `Absent,${summary.absent}\n`;
    csvContent += `Late,${summary.late}\n`;
    csvContent += `Excused,${summary.excused}\n`;
    csvContent += `Attendance Rate,${summary.attendanceRate}%\n\n`;
  
    // By User section
    csvContent += 'By User\n';
    csvContent += 'User Name,Present Days,Total Days,Attendance Rate\n';
    byUser.forEach((user: { userName: string; present: number; total: number; rate: number }) => {
      csvContent += `${user.userName},${user.present},${user.total},${user.rate}%\n`;
    });
    csvContent += '\n';
  
    // By Hiyaw Mahider section
    csvContent += 'By Hiyaw Mahider\n';
    csvContent += 'Hiyaw Mahider ID,Present,Total,Attendance Rate\n';
    byHiyawMahider.forEach((hiyaw: { hiyawMahiderId: string; present: number; total: number; rate: number }) => {
      csvContent += `${hiyaw.hiyawMahiderId},${hiyaw.present},${hiyaw.total},${hiyaw.rate}%\n`;
    });
    csvContent += '\n';
  
    // By Zone section
    csvContent += 'By Zone\n';
    csvContent += 'Zone,Present,Total,Attendance Rate\n';
    byZone.forEach((zone: { zone: string; present: number; total: number; rate: number }) => {
      csvContent += `${zone.zone},${zone.present},${zone.total},${zone.rate}%\n`;
    });
    csvContent += '\n';
  
    // By Date section
    csvContent += 'By Date\n';
    csvContent += 'Date,Present,Total,Attendance Rate\n';
    byDate.forEach((date: { date: string; present: number; total: number; rate: number }) => {
      csvContent += `${date.date},${date.present},${date.total},${date.rate}%\n`;
    });
    csvContent += '\n';
  
    // Detailed records
    csvContent += 'Detailed Records\n';
    csvContent += 'User Name,Date,Status,Hiyaw Mahider,Zone,Notes\n';
    records.forEach((record: { userName: string; date: string; status: string; hiyawMahiderId?: string; zone?: string; notes?: string }) => {
      csvContent += `"${record.userName}","${record.date}","${record.status}","${record.hiyawMahiderId || ''}","${record.zone || ''}","${record.notes || ''}"\n`;
    });
  
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }
  
  getAttendanceRecords(filters: any = {}): Observable<any[]> {
    const attendanceCollection = collection(this.firestore, 'attendances');

    // Start with base query ordered by date
    let q: Query<DocumentData> = query(attendanceCollection, orderBy('date', 'desc'));

    // Apply filters
    if (filters.hiyawMahiderId && filters.hiyawMahiderId !== '') {
      q = query(q, where('hiyawMahiderId', '==', filters.hiyawMahiderId));
    }

    if (filters.userId && filters.userId !== '') {
      q = query(q, where('userId', '==', filters.userId));
    }

    if (filters.zone && filters.zone !== '') {
      q = query(q, where('zone', '==', filters.zone));
    }

    if (filters.status && filters.status !== '') {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      q = query(q, where('date', '>=', startDate));
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('date', '<=', endDate));
    }

    return collectionData(q, { idField: 'id' });
  }
}