export interface Pastor {
    id?: string;
    name: string;
    phoneNumber: string;
    address: string;
    assignedHiyawMahider: string; // ID of the assigned Hiyaw Mahider
    status: 'Active' | 'Inactive' | 'On Hold' 
    createdAt?: Date;
    updatedAt?: Date;
  }