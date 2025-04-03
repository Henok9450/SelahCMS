import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Event } from '../../app/core/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  constructor(private afs: AngularFirestore) {}

  // Get upcoming events for a Hiyaw Mahider group
  getEventsForGroup(hiyawMahiderId: string, limit: number = 5): Observable<Event[]> {
    return this.afs.collection<Event>('events', ref => 
      ref.where('hiyawMahiderId', '==', hiyawMahiderId)
         .where('startTime', '>=', new Date())
         .orderBy('startTime')
         .limit(limit)
    ).valueChanges({ idField: 'id' });
  }

  // Get all events (past and future) for a group
  getAllGroupEvents(hiyawMahiderId: string): Observable<Event[]> {
    return this.afs.collection<Event>('events', ref => 
      ref.where('hiyawMahiderId', '==', hiyawMahiderId)
         .orderBy('startTime', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  // Create a new event
  createEvent(event: Event): Promise<void> {
    const id = this.afs.createId();
    return this.afs.collection('events').doc(id).set({
      ...event,
      id,
      createdAt: new Date()
    });
  }

  // Update an existing event
  updateEvent(eventId: string, data: Partial<Event>): Promise<void> {
    return this.afs.collection('events').doc(eventId).update(data);
  }

  // Delete an event
  deleteEvent(eventId: string): Promise<void> {
    return this.afs.collection('events').doc(eventId).delete();
  }
}