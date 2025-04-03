import { Timestamp } from 'firebase/firestore'; // For Firebase v9+

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'member' | 'pastor' | 'deputy_pastor' | 'zone_coordinator' | 'senior_pastor' | 'admin';
  hiyawMahiderId?: string;
  zoneId?: string;
  createdAt: Timestamp;
  lastLogin?: Timestamp;
  mustChangePassword: boolean;
  isActive: boolean;
}
