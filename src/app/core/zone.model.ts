import { Timestamp } from '@angular/fire/firestore'; // Import Timestamp from AngularFire

export interface Zone {
    id: string;
    code: string;
    name: string;
    status: 'active' | 'inactive';
    coordinators: string[]; // Array of pastor IDs
    createdAt: Timestamp; // Use Timestamp from AngularFire
    updatedAt: Timestamp; // Use Timestamp from AngularFire
}