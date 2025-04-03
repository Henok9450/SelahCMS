import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { ApprovalRequest } from '../core/approval-request.model';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  constructor(private afs: AngularFirestore) {}

  getAllPendingApprovals(): Observable<ApprovalRequest[]> {
    return this.afs.collection<ApprovalRequest>('approval_requests', ref => 
      ref.where('status', '==', 'pending')
    ).valueChanges({ idField: 'id' });
  }

  getPendingRoleChangeApprovals(): Observable<ApprovalRequest[]> {
    return this.afs.collection<ApprovalRequest>('approval_requests', ref => 
      ref.where('status', '==', 'pending')
         .where('type', '==', 'role_change')
    ).valueChanges({ idField: 'id' });
  }

  getPendingApprovalsForZone(zoneId: string): Observable<ApprovalRequest[]> {
    return this.afs.collection<ApprovalRequest>('approval_requests', ref => 
      ref.where('status', '==', 'pending')
         .where('zoneId', '==', zoneId)
    ).valueChanges({ idField: 'id' });
  }

  async approveRequest(requestId: string, processedBy: string): Promise<void> {
    await this.afs.collection('approval_requests').doc(requestId).update({
      status: 'approved',
      processedBy,
      processedAt: new Date()
    });
  }

  async rejectRequest(requestId: string, processedBy: string): Promise<void> {
    await this.afs.collection('approval_requests').doc(requestId).update({
      status: 'rejected',
      processedBy,
      processedAt: new Date()
    });
  }
}