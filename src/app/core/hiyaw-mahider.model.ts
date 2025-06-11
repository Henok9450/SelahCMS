import { Timestamp } from '@angular/fire/firestore';

export type HiyawMahiderStatus = 'Active' | 'Inactive' | 'On Hold' | 'Closed';

export interface HiyawMahider {
  id: string;
  name: string;
  code: string;
  location: string;
  status: HiyawMahiderStatus;
  pastor: string | null;
  zone: string | null;
  deputyPastor: string | null;
  studyDay: string | null;
  studyTime: string | null;
  createdDate: string | Date;
}