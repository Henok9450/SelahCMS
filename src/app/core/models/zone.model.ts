import { Timestamp } from '@angular/fire/firestore'; // Import Timestamp from AngularFire

export interface Zone {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  mainCoordinators: string[]; // Array of pastor IDs for Main Coordinators
  deputyCoordinators: string[]; // Array of pastor IDs for Deputy Coordinators
  createdAt: Timestamp; // Use Timestamp from AngularFire
  updatedAt: Timestamp; // Use Timestamp from AngularFire
}
