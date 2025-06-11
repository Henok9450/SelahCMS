import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Event } from '../core/events.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private firestore: Firestore = inject(Firestore);

  // Create a new event
  async createEvent(event: Omit<Event, 'id'>): Promise<string> {
    const eventsRef = collection(this.firestore, 'events');
    const docRef = await addDoc(eventsRef, {
      ...event,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  }

  // Get all events
  getEvents(): Observable<Event[]> {
    const eventsRef = collection(this.firestore, 'events');
    return collectionData(eventsRef, { idField: 'id' }) as Observable<Event[]>;
  }

  // Get events assigned to specific pastors
  getEventsForPastors(pastorIds: string[]): Observable<Event[]> {
    const eventsRef = collection(this.firestore, 'events');
    const q = query(eventsRef, where('assignedPastors', 'array-contains-any', pastorIds));
    return collectionData(q, { idField: 'id' }) as Observable<Event[]>;
  }

  // Update an event
  async updateEvent(eventId: string, eventData: Partial<Event>): Promise<void> {
    const eventRef = doc(this.firestore, `events/${eventId}`);
    await updateDoc(eventRef, {
      ...eventData,
      updatedAt: new Date().toISOString()
    });
  }

  // Delete an event
  async deleteEvent(eventId: string): Promise<void> {
    const eventRef = doc(this.firestore, `events/${eventId}`);
    await deleteDoc(eventRef);
  }
}