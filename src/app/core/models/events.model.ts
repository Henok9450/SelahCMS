// src/app/core/models/event.model.ts
import firebase from 'firebase/compat/app';
import { Timestamp } from 'firebase/firestore';

export interface Event {
  id?: '',
  title: '',
  description: '',
  type: 'group-study' | 'prayer-meeting' | 'church-gathering' | 'reminder' | 'other';
  startDateTime?: Date | Timestamp;
  endDate?: Date | Timestamp; 
  location?: string;
  assignedPastors: string[]; // Array of pastor IDs
  createdBy: string; // User ID of creator
  createdAt: Date | string;
  updatedAt?: Date | string;
  date: Date | Timestamp;
  isCompleted?: boolean;
  recurrence?: string; 
  startTime?: string; // e.g., "HH:MM" for input type="time"
  endTime?: string;   // e.g., "HH:MM" for input type="time"
  time?: string;
}
