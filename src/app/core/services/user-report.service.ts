import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  CollectionReference,
  DocumentReference,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { MemberService } from './member.service';

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
  constructor(private firestore: Firestore, private memberService: MemberService) {}

  /**
   * Fetches members from the REST API and transforms them to TransformedUser.
   * Replaces the legacy Firestore /users query.
   */
  async getUsers(filters: any = {}): Promise<TransformedUser[]> {
    try {
      const apiFilters: any = { pageSize: 200 };

      // Status filter: map 'Active' / 'Inactive' to REST API 'active' / 'inactive'
      if (filters.status) {
        apiFilters.status = filters.status.toLowerCase();
      }

      // Role filter (passed as-is, handled server-side if supported)
      if (filters.role) {
        apiFilters.role = filters.role;
      }

      // Hiyaw Mahider filter
      if (filters.hiyawMahiderId && filters.hiyawMahiderId !== 'ALL') {
        apiFilters.hiyawMahiderId = filters.hiyawMahiderId;
      }

      const response = await firstValueFrom(this.memberService.getMembers(apiFilters));
      const members = response?.data || [];

      // Map Member → TransformedUser (nulls are filtered out after date-range check)
      const usersRaw: (TransformedUser | null)[] = await Promise.all(
        members.map(async (m: any) => {
          const hiyawMahiderId = m.hyaw_mahider_id || 'N/A';
          const hiyawMahider =
            hiyawMahiderId !== 'N/A'
              ? await this.getHiyawMahiderName(hiyawMahiderId)
              : 'N/A';

          // Apply client-side date range filter (registration_date is what API exposes)
          if (filters.startDate || filters.endDate) {
            const createdAt = m.created_at ? new Date(m.created_at) : null;
            if (createdAt) {
              if (filters.startDate && createdAt < new Date(filters.startDate)) return null;
              if (filters.endDate && createdAt > new Date(filters.endDate)) return null;
            }
          }

          return {
            id: m.id,
            email: m.email || 'N/A',
            fullName: m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'N/A',
            phoneNumber: m.phone || m.contact?.phone || 'N/A',
            hiyawMahiderId,
            hiyawMahider,
            role: m.role || 'Member',
            status: (m.status && m.status.toLowerCase() === 'active') ? 'Active' : 'Inactive',
            createdAt: m.created_at ? new Date(m.created_at) : null
          } as TransformedUser;
        })
      );

      // Filter out nulls (date-range filtered out)
      return usersRaw.filter((u): u is TransformedUser => u !== null);

    } catch (error) {
      console.error('Error loading users from REST API:', error);
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
