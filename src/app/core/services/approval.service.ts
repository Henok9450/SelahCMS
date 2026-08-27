import { Injectable } from '@angular/core';
import { 
  Firestore,
  collection,
  collectionData,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ApprovalRequest } from '../models/approval-request.model';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  // Default page size for queries
  private readonly DEFAULT_PAGE_SIZE = 20;

  constructor(private firestore: Firestore) {}

  private get approvalsCollection() {
    return collection(this.firestore, 'approval_requests');
  }

  // Generic query helper with pagination
  private getQuery(
    additionalConditions: any[] = [],
    pageSize: number = this.DEFAULT_PAGE_SIZE
  ) {
    return query(
      this.approvalsCollection,
      where('status', '==', 'pending'),
      ...additionalConditions,
      orderBy('createdAt', 'desc'), // Ensures consistent ordering
      limit(pageSize)
    );
  }

  getAllPendingApprovals(pageSize?: number): Observable<ApprovalRequest[]> {
    return collectionData(
      this.getQuery([], pageSize), 
      { idField: 'id' }
    ) as Observable<ApprovalRequest[]>;
  }

  getPendingRoleChangeApprovals(pageSize?: number): Observable<ApprovalRequest[]> {
    return collectionData(
      this.getQuery([where('type', '==', 'role_change')], pageSize),
      { idField: 'id' }
    ) as Observable<ApprovalRequest[]>;
  }

  getPendingApprovalsForZone(zoneId: string, pageSize?: number): Observable<ApprovalRequest[]> {
    return collectionData(
      this.getQuery([
        where('zoneId', '==', zoneId)
      ], pageSize),
      { idField: 'id' }
    ) as Observable<ApprovalRequest[]>;
  }

  async approveRequest(requestId: string, processedBy: string): Promise<void> {
    await this.updateRequestStatus(requestId, {
      status: 'approved',
      processedBy
    });
  }

  async rejectRequest(requestId: string, processedBy: string): Promise<void> {
    await this.updateRequestStatus(requestId, {
      status: 'rejected',
      processedBy
    });
  }

  private async updateRequestStatus(
    requestId: string, 
    data: Partial<ApprovalRequest>
  ): Promise<void> {
    const docRef = doc(this.firestore, `approval_requests/${requestId}`);
    await updateDoc(docRef, {
      ...data,
      processedAt: serverTimestamp() // Better than new Date()
    });
  }
}
