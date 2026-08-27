export interface User {
  uid?: string; // Firebase document ID
  memberId?: string; // Backend Membership API ID
  fullName: string;
  phoneNumber: string;
  residencyLocation: string;
  maritalStatus: 'Married' | 'Single';
  assignedHiyawMahider?: string | null; // Reference to Hiyaw Mahider ID
  pastor?: string;
  deputyPastor?: string;
  //userName: string;
  password?: string; // Only for initial setup
  active: boolean;
  role: 'Admin' | 'Pastor' | 'Deputy Pastor' | 'Member' | 'Zone Coordinator';
  firstLogin: boolean; // To force password reset
  createdAt: Date;
  updatedAt: Date;
  hiyawMahiderName?: string;
  pastorName?: string;
  deputyPastorName?: string;
  mustChangePassword?: boolean;
  email: string;
  displayName?: string | null;
  emailVerified?: boolean;
}

