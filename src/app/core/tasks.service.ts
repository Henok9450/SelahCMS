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
  Firestore,
  Timestamp,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  DocumentSnapshot,
  FirestoreError,
} from 'firebase/firestore';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { Task } from './tasks.model';
import { switchMap, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

function convertFirebaseDate(field: any): Date | null {
  if (!field) return null;
  if (field instanceof Timestamp) {
    return field.toDate();
  }
  if (field instanceof Date) {
    return field;
  }
  if (typeof field === 'string') {
    const date = new Date(field);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private db: Firestore;

  // Use distinct BehaviorSubjects for each filter type
  private _statusFilter = new BehaviorSubject<string | null>(null);
  private _adminHiyawMahiderFilter = new BehaviorSubject<string | null>(null); // New B.S. for Admin's Hiyaw Mahider filter
  private _currentUserHiyawMahiderId = new BehaviorSubject<string | null>(null);
  private _currentUserRole = new BehaviorSubject<string | null>(null);

  contextualTasks$!: Observable<Task[]>;

  constructor() {
    const app = initializeApp(environment.firebase);
    this.db = getFirestore(app);
    this.initialize();
  }

  initialize() {
    // Combine all relevant subjects to determine the final task query
    this.contextualTasks$ = combineLatest([
      this._currentUserRole,
      this._currentUserHiyawMahiderId,
      this._adminHiyawMahiderFilter, // Include the admin filter here
      this._statusFilter // If you want to integrate status filtering at the service level
    ]).pipe(
      switchMap(([role, userHiyawMahiderId, adminFilterMahiderId, statusFilter]) => {
        return this._getTasksBasedOnContext(role, userHiyawMahiderId, adminFilterMahiderId, statusFilter);
      }),
      tap(tasks => console.log('TasksService: Emitting tasks:', tasks)) // Debugging line
    );
  }

  // Setters for the BehaviorSubjects
  setCurrentUserHiyawMahiderId(id: string | null) {
    this._currentUserHiyawMahiderId.next(id);
  }

  setCurrentUserRole(role: string | null) {
    this._currentUserRole.next(role);
  }

  // New setter for the Admin's Hiyaw Mahider filter
  setAdminHiyawMahiderFilter(groupId: string | null) {
    this._adminHiyawMahiderFilter.next(groupId);
  }

  // Setter for status filter
  setStatusFilter(status: string | null) {
    this._statusFilter.next(status);
  }

  private mapFirestoreDocToTask(doc: DocumentSnapshot<DocumentData>): Task {
    const data = doc.data();
    if (!data) {
      console.warn(`Document with ID ${doc.id} has no data.`);
      return {
        id: doc.id,
        title: 'No Title',
        description: '',
        assignedTo: '',
        assignedBy: '',
        hiyawMahiderId: '',
        status: 'pending',
        type: 'read',
        biblePassage: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: new Date(),
        hiyawMahiderName: '',
      };
    }

    return {
      id: doc.id,
      title: data['title'] || '',
      description: data['description'] || '',
      assignedTo: data['assignedTo'] || '',
      assignedToName: data['assignedToName'],
      assignedBy: data['assignedBy'] || '',
      assignedByName: data['assignedByName'],
      hiyawMahiderId: data['hiyawMahiderId'] || '', // This is the Hiyaw Mahider the task belongs to
      status: data['status'] || 'pending',
      type: data['type'] || 'read',
      biblePassage: data['biblePassage'] || '',
      createdAt: convertFirebaseDate(data['createdAt']) || new Date(),
      updatedAt: convertFirebaseDate(data['updatedAt']),
      dueDate: convertFirebaseDate(data['dueDate']) || new Date(),
      hiyawMahiderName: data['hiyawMahiderName'] || '',
      priority: data['priority'],
      createdByHiyawMahiderId: data['createdByHiyawMahiderId'], // Hiyaw Mahider of the creator
      assignedToHiyawMahiderId: data['assignedToHiyawMahiderId'], // Hiyaw Mahider the task is assigned to
    } as Task;
  }

  private _getTasksBasedOnContext(
    role: string | null,
    userHiyawMahiderId: string | null,
    adminFilterMahiderId: string | null,
    statusFilter: string | null // Pass status filter here
  ): Observable<Task[]> {
    return new Observable(subscriber => {
      let tasksCollectionRef = collection(this.db, 'tasks');
      let q: any;

     if (role === 'Admin') {
        if (adminFilterMahiderId) {
          q = query(
            tasksCollectionRef,
            where('createdByHiyawMahiderId', '==', adminFilterMahiderId), // <-- Change this line
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(tasksCollectionRef, orderBy('createdAt', 'desc'));
        }
      } else if (['Pastor', 'Deputy Pastor', 'Member'].includes(role || '')) {
        if (userHiyawMahiderId) {
          // Pastors/Members only see tasks related to their assigned Hiyaw Mahider
          q = query(
            tasksCollectionRef,
            where('hiyawMahiderId', '==', userHiyawMahiderId), // Or createdByHiyawMahiderId depending on your exact requirement
            orderBy('createdAt', 'desc')
          );
        } else {
          // If a non-admin role has no assigned Hiyaw Mahider, return empty
          subscriber.next([]);
          return { unsubscribe: () => { } };
        }
      } else {
        // Unrecognized role or no role, return empty
        subscriber.next([]);
        return { unsubscribe: () => { } };
      }

      // Apply status filter if it exists
      if (statusFilter && statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      }


      const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
        const tasks = querySnapshot.docs.map(doc => this.mapFirestoreDocToTask(doc));
        console.log(`_getTasksBasedOnContext (${role}, ${userHiyawMahiderId}, ${adminFilterMahiderId}, ${statusFilter}):`, tasks);
        subscriber.next(tasks);
      }, (error: FirestoreError) => {
        console.error("Error fetching tasks based on context:", error);
        subscriber.error(error);
      });

      return { unsubscribe };
    });
  }

  // The rest of your CRUD and utility methods remain the same,
  // but ensure `createTask` also sets `hiyawMahiderId` correctly.

  async createTask(task: Task): Promise<void> {
    const tasksCollection = collection(this.db, 'tasks');
    const newDocRef = doc(tasksCollection);

    const taskDataForFirestore: DocumentData = {
      title: task.title,
      description: task.description || '',
      assignedTo: task.assignedTo || '',
      assignedToName: task.assignedToName || null,
      assignedBy: task.assignedBy || '',
      assignedByName: task.assignedByName || null,
      hiyawMahiderId: task.hiyawMahiderId || null, // Ensure this is set for tasks created
      status: task.status,
      type: task.type,
      biblePassage: task.biblePassage || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dueDate: task.dueDate instanceof Date ? Timestamp.fromDate(task.dueDate) : task.dueDate || null,
      hiyawMahiderName: task.hiyawMahiderName || '',
      priority: task.priority || null,
      createdByHiyawMahiderId: task.createdByHiyawMahiderId || null,
      assignedToHiyawMahiderId: task.assignedToHiyawMahiderId || null,
      id: newDocRef.id
    };

    await setDoc(newDocRef, taskDataForFirestore);
  }

  async updateTask(taskId: string, data: Partial<Task>): Promise<void> {
    const taskDoc = doc(this.db, 'tasks', taskId);
    const updateData: DocumentData = {
      ...data,
      updatedAt: serverTimestamp()
    };

    if (data['dueDate'] instanceof Date) {
      updateData['dueDate'] = Timestamp.fromDate(data['dueDate']);
    } else if (data['dueDate'] === null) {
      updateData['dueDate'] = null;
    }

    if (data['createdAt'] instanceof Date) {
      updateData['createdAt'] = Timestamp.fromDate(data['createdAt']);
    }

    await updateDoc(taskDoc, updateData);
  }

  async deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'tasks', taskId));
  }

  getHiyawMahiders(): Observable<any[]> {
    return new Observable(subscriber => {
      const q = query(collection(this.db, 'hiyawMahiders'));
      const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
        const mahiders: any[] = [];
        querySnapshot.forEach((doc: DocumentSnapshot<DocumentData>) => {
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
        where('assignedHiyawMahider', '==', mahiderId),
        where('role', '==', 'Member')
      );
      const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
        const members: any[] = [];
        querySnapshot.forEach((doc: DocumentSnapshot<DocumentData>) => {
          members.push({ id: doc.id, ...doc.data() });
        });
        subscriber.next(members);
      });
      return { unsubscribe };
    });
  }
}