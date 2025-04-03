// src/app/core/models/task.model.ts
import firebase from 'firebase/compat/app';

export interface Task {
  id?: string;
  title: string;
  description: string;
  assignedTo: string; // User ID
  assignedToName?: string; // User display name
  hiyawMahiderId: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate: firebase.firestore.Timestamp | Date;
  createdAt: firebase.firestore.Timestamp | Date;
  updatedAt?: firebase.firestore.Timestamp | Date;
}