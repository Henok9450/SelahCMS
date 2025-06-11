import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { Task } from './tasks.model';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { serverTimestamp } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

function convertFirebaseDate(field: any): Date | null {
  if (!field) return null;
  if (field instanceof Timestamp) {
    return field.toDate();
  }
  if (field instanceof Date) {
    return field;
  }
  if (typeof field === 'string') {
    return new Date(field);
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private db: Firestore;
  
  // State subjects
  private _maxItems = new BehaviorSubject<number>(5);
  private _statusFilter = new BehaviorSubject<string | null>(null);
  private _groupFilter = new BehaviorSubject<string | null>(null);
  private _userId = new BehaviorSubject<string | null>(null);

  constructor() {
    // Initialize Firebase
    const app = initializeApp(environment.firebase);
    this.db = getFirestore(app);
  }

  // Public observables
  recentTasks$!: Observable<Task[]>;
  filteredTasks$!: Observable<Task[]>;

  // Initialize observables
  initialize() {
    this.recentTasks$ = combineLatest([
      this._userId,
      this._statusFilter,
      this._maxItems
    ]).pipe(
      switchMap(([userId, status, maxItems]) => {
        if (!userId) return of([]);
        return this.getRecentTasks(userId, status, maxItems);
      })
    );

    this.filteredTasks$ = combineLatest([
      this._groupFilter,
      this._maxItems
    ]).pipe(
      switchMap(([groupId, maxItems]) => {
        if (!groupId) return of([]);
        return this.getTasksByGroup(groupId, maxItems);
      })
    );
  }

  getTasks(): Observable<Task[]> {
    return new Observable(subscriber => {
      const q = query(
        collection(this.db, 'tasks'),
        orderBy('createdAt', 'desc')
      );
  
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data['title'],
            description: data['description'],
            status: data['status'],
            dueDate: convertFirebaseDate(data['dueDate']),
            createdAt: convertFirebaseDate(data['createdAt']) || new Date(),
            updatedAt: convertFirebaseDate(data['updatedAt']) || new Date()
          } as Task;
        });
        console.log('Loaded tasks:', tasks); // Debug log
        subscriber.next(tasks);
      });
  
      return { unsubscribe };
    });
  }

  getLimitedTasks(maxItems: number): Observable<Task[]> {
    return new Observable(subscriber => {
      const q = query(
        collection(this.db, 'tasks'),
        orderBy('dueDate', 'asc'),
        limit(maxItems)
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks: Task[] = [];
        querySnapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        subscriber.next(tasks);
      });

      return { unsubscribe }; // Cleanup function
    });
  }

  // Setters for state
  setMaxItems(max: number) {
    this._maxItems.next(max);
  }

  setStatusFilter(status: string | null) {
    this._statusFilter.next(status);
  }

  setGroupFilter(groupId: string | null) {
    this._groupFilter.next(groupId);
  }

  setUserId(userId: string | null) {
    this._userId.next(userId);
  }

  getRecentTasks(userId: string, status?: string | null, maxItems?: number): Observable<Task[]> {
    return new Observable(subscriber => {
      let q = query(
        collection(this.db, 'tasks'),
        where('assignedTo', '==', userId),
        orderBy('dueDate', 'asc')
      );

      if (status) {
        q = query(q, where('status', '==', status));
      }
      if (maxItems) {
        q = query(q, limit(maxItems));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks: Task[] = [];
        querySnapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        subscriber.next(tasks);
      });

      return { unsubscribe }; // Cleanup function
    });
  }

  getTasksByGroup(groupId: string, maxItems?: number): Observable<Task[]> {
    return new Observable(subscriber => {
      let q = query(
        collection(this.db, 'tasks'),
        where('hiyawMahiderId', '==', groupId),
        orderBy('createdAt', 'desc')
      );

      if (maxItems) {
        q = query(q, limit(maxItems));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks: Task[] = [];
        querySnapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        subscriber.next(tasks);
      });

      return { unsubscribe }; // Cleanup function
    });
  }

  async createTask(task: Task): Promise<void> {
    const tasksCollection = collection(this.db, 'tasks');
    const newDocRef = doc(tasksCollection);
    await setDoc(newDocRef, {
      ...task,
      iid: newDocRef.id,
      dueDate: task.dueDate,
      createdAt: serverTimestamp(),  
      updatedAt: serverTimestamp()
    });
  }

  async updateTask(taskId: string, data: Partial<Task>): Promise<void> {
    const taskDoc = doc(this.db, 'tasks', taskId);
    await updateDoc(taskDoc, {
      ...data,
      updatedAt: new Date()
    });
  }

  // Add these to your TasksService class

getHiyawMahiders(): Observable<any[]> {
  return new Observable(subscriber => {
    const q = query(collection(this.db, 'hiyawMahiders'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mahiders: any[] = [];
      querySnapshot.forEach((doc) => {
        mahiders.push({ id: doc.id, ...doc.data() });
      });
      subscriber.next(mahiders);
    });
    return { unsubscribe };
  });
}

getMembersInMahider(mahiderId: string): Observable<any[]> {
  return new Observable(subscriber => {
    const q = query(
      collection(this.db, 'users'),
      where('hiyawMahiderId', '==', mahiderId),
      where('role', '==', 'member')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const members: any[] = [];
      querySnapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() });
      });
      subscriber.next(members);
    });
    return { unsubscribe };
  });
}

  async deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'tasks', taskId));
  }
}