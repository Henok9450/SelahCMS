import firebase from 'firebase/compat/app';
import { Timestamp } from 'firebase/firestore';

export interface Task {
  id?: string;
  title: string;
  description: string;
  assignedTo: string;          
  assignedToName?: string;     
  assignedBy: string;          
  assignedByName?: string;     
  hiyawMahiderId: string;      
  status: 'pending' | 'in_progress' | 'completed';
  type: 'memorize' | 'read' | 'reflect' | 'practice'; 
  biblePassage: string;        
  createdAt: firebase.firestore.Timestamp | Date;
  updatedAt?: firebase.firestore.Timestamp | Date;
  dueDate: Date | Timestamp; 
  hiyawMahiderName: string;
  priority?: 'Low' | 'Medium' | 'High' | string; 
  createdByUserId?: string;
  createdByHiyawMahiderId?: string;
  assignedToHiyawMahiderId?: string;
}
