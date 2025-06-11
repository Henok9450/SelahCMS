import firebase from 'firebase/compat/app';
import { Timestamp } from 'firebase/firestore';

export interface Task {
  id?: string;
  title: string;
  description: string;
  assignedTo: string;          // User ID
  assignedToName?: string;     // User display name
  assignedBy: string;          // Admin ID (who assigned the task)
  assignedByName?: string;     // Admin display name
  hiyawMahiderId: string;      // Links to your study system
  status: 'pending' | 'in_progress' | 'completed';
  type: 'memorize' | 'read' | 'reflect' | 'practice'; // Task category
  biblePassage: string;        // e.g., "John 3:16"
  createdAt: firebase.firestore.Timestamp | Date;
  updatedAt?: firebase.firestore.Timestamp | Date;
  dueDate: Date | Timestamp; 
  hiyawMahiderName: string;
}