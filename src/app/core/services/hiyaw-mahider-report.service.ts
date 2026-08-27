import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, CollectionReference, DocumentData, Query, orderBy } from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';


export interface HiyawMahider {
  id: string;
  code: string;
  createdDate: string;
  deputyPastor: string;
  location: string;
  name: string;
  pastor: string;
  status: string;
  studyDay: string;
  studyTime: string;
  zone: string;
  zoneName?: string;
  HostName?: string; 
  HostContactNumber?: string; 
}

export interface HiyawMahiderReportData {
  totalHiyawMahiders: number;
  activeCount: number;
  inactiveCount: number;
  byZone: { [zoneId: string]: number };
  byStudyDay: { [day: string]: number };
  hiyawMahiders: HiyawMahider[];
}

@Injectable({
  providedIn: 'root'
})
export class HiyawMahiderReportService {
  constructor(private firestore: Firestore) {}

  getHiyawMahiders(filters: any = {}): Observable<HiyawMahider[]> {
    const hiyawMahidersCollection = collection(this.firestore, 'hiyawMahiders');
    let q: Query<DocumentData> = query(hiyawMahidersCollection, orderBy('nameLower', 'asc'));

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters.zone) {
      q = query(q, where('zone', '==', filters.zone));
    }

    if (filters.studyDay) {
      q = query(q, where('studyDay', '==', filters.studyDay));
    }

    if (filters.searchTerm) {
      q = query(q, 
        where('nameLower', '>=', filters.searchTerm.toLowerCase()),
        where('nameLower', '<=', filters.searchTerm.toLowerCase() + '\uf8ff')
      );
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map(records => records.map(record => this.transformHiyawMahiderData(record))),
      tap(records => console.log('Processed Hiyaw Mahider records:', records))
    );
  }

  transformHiyawMahiderData(record: any): HiyawMahider {
    return {
      id: record.id || 'N/A',
      code: record.code || 'N/A',
      createdDate: this.formatDate(record.createdDate),
      deputyPastor: record.deputyPastor || 'N/A',
      location: record.location || 'N/A',
      name: record.name || 'N/A',
      pastor: record.pastor || 'N/A',
      status: record.status || 'N/A',
      studyDay: record.studyDay || 'N/A',
      studyTime: record.studyTime || 'N/A',
      zone: record.zone || 'N/A',
      HostName: record.HostName || 'N/A',
      HostContactNumber: record.HostContactNumber || record.hostContactNumber || 'N/A'
    };
  }

  getZones(): Observable<{ id: string, name: string }[]> {
    const zonesCollection = collection(this.firestore, 'zones');
    return collectionData(zonesCollection, { idField: 'id' }).pipe(
      map((zones: DocumentData[]) => 
        zones.map((z: any) => ({ id: z['id'], name: z['name'] }))
    ),
    tap(zones => {
      // THIS IS CRUCIAL: Log what your service receives from Firestore for zones
      console.log('Service: Fetched Zones from Firestore:', zones);
    }),
    catchError(error => {
      console.error('Service: Error fetching zones:', error);
      return of([]); // Return an empty array to prevent breaking the app if zones fail to load
    })
    );
  }

  generateHiyawMahiderReport(hiyawMahiders: HiyawMahider[], zones: { id: string, name: string }[] = []): HiyawMahiderReportData {
    console.log('Service: Generating report with Hiyaw Mahiders:', hiyawMahiders);
    console.log('Service: Zones provided for report generation:', zones);
      // First normalize all zone references to use names
  const normalizedData = hiyawMahiders.map(hm => {
    const zoneName = zones.find(z => z.id === hm.zone || z.name === hm.zone)?.name || `Unknown Zone (${hm.zone})`;
    return {
      ...hm,
      zoneName: zoneName,
      zone: zoneName // Replace the zone reference with the name
    };
  });
    const enhancedHiyawMahiders = hiyawMahiders.map(hm => ({
        ...hm,
        zoneName: zones.find(z => z.id === hm.zone)?.name || 'Unknown Zone'
    }));

    const activeCount = enhancedHiyawMahiders.filter(hm => hm.status === 'Active').length;
    const inactiveCount = enhancedHiyawMahiders.length - activeCount;

    // Group by zone name (since we normalized everything)
  const byZone: { [zoneName: string]: number } = {};
  normalizedData.forEach(hm => {
    byZone[hm.zoneName] = (byZone[hm.zoneName] || 0) + 1;
  });

    // Group by study day
    const byStudyDay: { [day: string]: number } = {};
    enhancedHiyawMahiders.forEach(hm => {
        byStudyDay[hm.studyDay] = (byStudyDay[hm.studyDay] || 0) + 1;
    });

    return {
        totalHiyawMahiders: enhancedHiyawMahiders.length,
        activeCount,
        inactiveCount,
        byZone,
        byStudyDay,
        hiyawMahiders: enhancedHiyawMahiders
    };
}

  exportToCSV(data: HiyawMahider[], filename: string) {
    if (!data || data.length === 0) {
      console.error('No data to export');
      return;
    }

    const csvRows = [];
    const headers = [
      'Code', 'Name', 'Host Name', 'Host Contact Number', 'Location', 'Pastor', 'Deputy Pastor', 'Status', 
      'Study Day', 'Study Time', 'Zone', 'Created Date'
    ];
    
    csvRows.push(headers.join(','));

    for (const hm of data) {
      const values = [
        `"${(hm.code || '').replace(/"/g, '""')}"`,
        `"${(hm.name || '').replace(/"/g, '""')}"`,
        `"${(hm.HostName || '').replace(/"/g, '""')}"`,  
      `"${(hm.HostContactNumber || '').replace(/"/g, '""')}"`,  
        `"${(hm.location || '').replace(/"/g, '""')}"`,
        `"${(hm.pastor || '').replace(/"/g, '""')}"`,
        `"${(hm.deputyPastor || '').replace(/"/g, '""')}"`,
        `"${(hm.status || '').replace(/"/g, '""')}"`,
        `"${(hm.studyDay || '').replace(/"/g, '""')}"`,
        `"${(hm.studyTime || '').replace(/"/g, '""')}"`,
        `"${(hm.zoneName || hm.zone || '').replace(/"/g, '""')}"`,
        `"${(hm.createdDate || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    this.downloadFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  private formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    
    try {
      if (dateInput.toDate) {
        return dateInput.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
    
    return 'N/A';
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
