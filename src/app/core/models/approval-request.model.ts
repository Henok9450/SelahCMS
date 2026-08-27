import firebase from 'firebase/compat/app';

export interface ApprovalRequest {
  id?: string; // Added by valueChanges({ idField: 'id' })
  type: 'new_member' | 'role_change' | 'other'; // Add other types as needed
  requesterId: string;
  targetUserId?: string;
  currentData?: any;
  requestedData: any;
  status: 'pending' | 'approved' | 'rejected';
  processedBy?: string;
  processedAt?: firebase.firestore.Timestamp | Date;
  createdAt: firebase.firestore.Timestamp | Date;
  zoneId?: string;
  hiyawMahiderId?: string;
  // Add any other fields you need
}
