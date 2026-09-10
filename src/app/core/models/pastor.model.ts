export interface Pastor {
    id?: string;
    memberId?: string; // Foreign key to central API Member
    memberCode?: string; // Central Member Code (e.g. MEM-0123)
    email?: string;
    isExternal?: boolean; // Flag for visiting/external pastor not in central member directory
    name: string;
    phoneNumber: string;
    address: string;
    assignedHiyawMahider: string; // ID of the assigned Hiyaw Mahider
    status: 'Active' | 'Inactive' | 'On Hold';
    role: 'Pastor' | 'Deputy Pastor';
    createdAt?: Date;
    updatedAt?: Date;
  }
