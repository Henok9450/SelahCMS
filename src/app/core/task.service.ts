import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Task } from '../core/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(private afs: AngularFirestore) {}

  // Get tasks assigned to a specific user with optional status filter
  getUserTasks(userId: string, status?: string): Observable<Task[]> {
    if (status) {
      return this.afs.collection<Task>('tasks', ref => 
        ref.where('assignedTo', '==', userId)
           .where('status', '==', status)
      ).valueChanges({ idField: 'id' });
    }
    return this.afs.collection<Task>('tasks', ref => 
      ref.where('assignedTo', '==', userId)
    ).valueChanges({ idField: 'id' });
  }

  // Get all tasks for a Hiyaw Mahider group
  getTasksByGroup(hiyawMahiderId: string): Observable<Task[]> {
    return this.afs.collection<Task>('tasks', ref => 
      ref.where('hiyawMahiderId', '==', hiyawMahiderId)
    ).valueChanges({ idField: 'id' });
  }

  // Create a new task
  createTask(task: Task): Promise<void> {
    const id = this.afs.createId();
    return this.afs.collection('tasks').doc(id).set({
      ...task,
      id,
      createdAt: new Date()
    });
  }

  // Update an existing task
  updateTask(taskId: string, data: Partial<Task>): Promise<void> {
    return this.afs.collection('tasks').doc(taskId).update(data);
  }

  // Delete a task
  deleteTask(taskId: string): Promise<void> {
    return this.afs.collection('tasks').doc(taskId).delete();
  }
}