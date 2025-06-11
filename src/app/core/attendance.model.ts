import { Timestamp } from '@angular/fire/firestore';

export interface AttendanceMember {
  userId: string;
  fullName: string;
  status: string;
  reason?: string;
}

export interface Attendance {
  id: string;
  hiyawMahiderId: string;
  hiyawMahiderName: string;
  studyDay: string;
  date: Date | Timestamp;
  members: AttendanceMember[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface SpecialStudyDay {
  date: Date | Timestamp;
  studyDay: string;
  reason: string;
}

export interface HiyawMahiderStudyDay {
  hiyawMahiderId: string;
  defaultDay: string;
  specialDays: SpecialStudyDay[];
}