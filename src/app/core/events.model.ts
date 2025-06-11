// src/app/core/models/event.model.ts
import firebase from 'firebase/compat/app';

export interface Event {
  id?: string;
  title: string;
  description: string;
  type: 'group-study' | 'prayer-meeting' | 'church-gathering' | 'reminder' | 'other';
  startDateTime: Date | string;
  endDateTime: Date | string;
  location?: string;
  assignedPastors: string[]; // Array of pastor IDs
  createdBy: string; // User ID of creator
  createdAt: Date | string;
  updatedAt?: Date | string;
}