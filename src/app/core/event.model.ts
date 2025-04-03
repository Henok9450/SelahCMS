// src/app/core/models/event.model.ts
import firebase from 'firebase/compat/app';

export interface Event {
  id?: string;
  title: string;
  description: string;
  startTime: firebase.firestore.Timestamp | Date;
  endTime: firebase.firestore.Timestamp | Date;
  location?: string;
  hiyawMahiderId: string;
  createdBy: string; // User ID
  createdAt: firebase.firestore.Timestamp | Date;
  updatedAt?: firebase.firestore.Timestamp | Date;
}