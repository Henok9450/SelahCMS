import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { Observable, catchError, of, map } from 'rxjs';
import { Event } from '../core/events.model';
import { docData } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { ensureValidDate } from '../../../src/app/pages/Utility/date.utils'; // Adjust path if needed based on your project structure

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private firestore: Firestore = inject(Firestore);

  // Create a new event
  async createEvent(event: Partial<Event>): Promise<string> {
    const eventsRef = collection(this.firestore, 'events');
    const docRef = await addDoc(eventsRef, {
      ...event,
      // Ensure date/time properties are converted to Firestore Timestamp
      startDateTime: this.prepareDateForFirestore(event.startDateTime),
      endDate: this.prepareDateForFirestore(event.endDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  }

  // Helper to convert Date/string/Timestamp to Firestore Timestamp
  private prepareDateForFirestore(date: any): Timestamp | null {
    const validDate = ensureValidDate(date); // Uses your utility to get a JS Date object
    return validDate ? Timestamp.fromDate(validDate) : null;
  }

  // Get all events
  getEvents(): Observable<Event[]> {
    const eventsRef = collection(this.firestore, 'events');
    // Using snapshotChanges().pipe(map(...)) for more control over ID and data conversion
    return collectionData(eventsRef, { idField: 'id' }).pipe(
      map(events => events.map(event => ({
        ...event,
        // Ensure startDateTime and endDate are converted to Date objects
        startDateTime: event['startDateTime'] instanceof Timestamp ? event['startDateTime'].toDate() : new Date(event['startDateTime']),
        endDate: event['endDate'] instanceof Timestamp ? event['endDate'].toDate() : new Date(event['endDate']),
        createdAt: event['createdAt'] instanceof Timestamp ? event['createdAt'].toDate() : new Date(event['createdAt'] || Date.now()),
        updatedAt: event['updatedAt'] instanceof Timestamp ? event['updatedAt'].toDate() : (event['updatedAt'] ? new Date(event['updatedAt']) : undefined),
        date: event['date'] instanceof Timestamp ? event['date'].toDate() : new Date(event['date'] || Date.now())
      }) as Event))
    );
  }

  // Get events assigned to specific pastors (No changes needed here for date handling)
  getEventsForPastors(pastorIds: string[]): Observable<Event[]> {
    const eventsRef = collection(this.firestore, 'events');
    const q = query(eventsRef, where('assignedPastors', 'array-contains-any', pastorIds));
    return collectionData(q, { idField: 'id' }).pipe(
      map(events => events.map(event => ({
        ...event,
        startDateTime: event['startDateTime'] instanceof Timestamp ? event['startDateTime'].toDate() : new Date(event['startDateTime']),
        endDate: event['endDate'] instanceof Timestamp ? event['endDate'].toDate() : new Date(event['endDate']),
        createdAt: event['createdAt'] instanceof Timestamp ? event['createdAt'].toDate() : new Date(event['createdAt'] || Date.now()),
        updatedAt: event['updatedAt'] instanceof Timestamp ? event['updatedAt'].toDate() : (event['updatedAt'] ? new Date(event['updatedAt']) : undefined),
        date: event['date'] instanceof Timestamp ? event['date'].toDate() : new Date(event['date'] || Date.now())
      }) as Event))
    );
  }

  // Update an event
  async updateEvent(eventId: string, eventData: Partial<Event>): Promise<void> {
    const eventRef = doc(this.firestore, `events/${eventId}`);
    
    // Create a mutable copy and prepare dates for Firestore
    const dataToUpdate: any = { ...eventData };

    if (dataToUpdate.startDateTime) {
      dataToUpdate.startDateTime = this.prepareDateForFirestore(dataToUpdate.startDateTime);
    }
    if (dataToUpdate.endDate) {
      dataToUpdate.endDate = this.prepareDateForFirestore(dataToUpdate.endDate);
    }
    
    // Ensure updatedAt is always a Timestamp
    dataToUpdate.updatedAt = Timestamp.now(); 

    await updateDoc(eventRef, dataToUpdate);
  }

  // Delete an event
  async deleteEvent(eventId: string): Promise<void> {
    const eventRef = doc(this.firestore, `events/${eventId}`);
    await deleteDoc(eventRef);
  }

  // Get a single event by ID
  getEvent(eventId: string): Observable<Event | null> {
    const eventDocRef = doc(this.firestore, `events/${eventId}`);
    return docData(eventDocRef).pipe(
      map((data: any) => {
        if (!data) return null;
        return {
          id: eventId,
          title: data.title || '',
          location: data.location || '',
          description: data.description || '',
          // Convert Firestore Timestamps to JavaScript Date objects upon retrieval
          startDateTime: data.startDateTime instanceof Timestamp ? data.startDateTime.toDate() : new Date(data.startDateTime),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate() : new Date(data.endDate),
          type: data.type || 'other',
          assignedPastors: data.assignedPastors || [],
          isCompleted: data.isCompleted || false,
          recurrence: data.recurrence || 'none',
          createdBy: data.createdBy || 'Unknown',
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date || Date.now()),
        } as Event;
      }),
      catchError((error) => {
        console.error(`Error fetching event with ID ${eventId}:`, error);
        return of(null);
      })
    );
  }
}