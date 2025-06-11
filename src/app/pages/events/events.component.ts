import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EventsService } from '../../core/events.service';
import { Event } from '../../core/events.model';
import { EventDialogComponent } from '../../pages/events/event-dialog/event-dialog.component';
import { PastorService } from '../../core/pastor.service';
import { Pastor } from '../../core/pastor.model';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css']
})
export class EventsComponent {
  private eventsService = inject(EventsService);
  private pastorsService = inject(PastorService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  events: Event[] = [];
  filteredEvents: Event[] = [];
  pastors: Pastor[] = [];
  selectedTab = 'all';
  selectedPastorId = '';
  eventTypes = [
    { value: 'group-study', label: 'Group Study Session' },
    { value: 'prayer-meeting', label: 'Prayer Meeting' },
    { value: 'church-gathering', label: 'Church Gathering' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'other', label: 'Other' }
  ];

  ngOnInit() {
    this.loadEvents();
    this.loadPastors();
  }

  loadEvents() {
    this.eventsService.getEvents().subscribe(events => {
      this.events = events.map(event => ({
        ...event,
        startDateTime: new Date(event.startDateTime as string),
        endDateTime: new Date(event.endDateTime as string)
      }));
      this.filterEvents();
    });
  }

  loadPastors() {
    this.pastorsService.getPastors().subscribe(pastors => {
      this.pastors = pastors;
    });
  }

  filterEvents() {
    if (this.selectedTab === 'all') {
      this.filteredEvents = [...this.events];
    } else if (this.selectedPastorId) {
      this.filteredEvents = this.events.filter(event => 
        event.assignedPastors.includes(this.selectedPastorId)
      );
    }
  }

  onTabChange(tab: string) {
    this.selectedTab = tab;
    this.filterEvents();
  }

  onPastorSelect(pastorId: string) {
    this.selectedPastorId = pastorId;
    this.filterEvents();
  }

  openAddEventDialog() {
    const dialogRef = this.dialog.open(EventDialogComponent, {
      width: '600px',
      data: {
        pastors: this.pastors,
        eventTypes: this.eventTypes
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.eventsService.createEvent(result).then(() => {
          this.snackBar.open('Event created successfully!', 'Close', { duration: 3000 });
          this.loadEvents();
        }).catch(error => {
          this.snackBar.open('Error creating event: ' + error.message, 'Close', { duration: 5000 });
        });
      }
    });
  }

  openEditEventDialog(event: Event) {
    const dialogRef = this.dialog.open(EventDialogComponent, {
      width: '600px',
      data: {
        event,
        pastors: this.pastors,
        eventTypes: this.eventTypes,
        isEdit: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && event.id) {
        this.eventsService.updateEvent(event.id, result).then(() => {
          this.snackBar.open('Event updated successfully!', 'Close', { duration: 3000 });
          this.loadEvents();
        }).catch(error => {
          this.snackBar.open('Error updating event: ' + error.message, 'Close', { duration: 5000 });
        });
      }
    });
  }

  deleteEvent(eventId: string) {
    if (confirm('Are you sure you want to delete this event?')) {
      this.eventsService.deleteEvent(eventId).then(() => {
        this.snackBar.open('Event deleted successfully!', 'Close', { duration: 3000 });
        this.loadEvents();
      }).catch(error => {
        this.snackBar.open('Error deleting event: ' + error.message, 'Close', { duration: 5000 });
      });
    }
  }

  getEventTypeLabel(type: string): string {
    const found = this.eventTypes.find(t => t.value === type);
    return found ? found.label : type;
  }

  getAssignedPastorsNames(assignedPastors: string[]): string {
    return assignedPastors
      .map(id => {
        const pastor = this.pastors.find(p => p.id === id);
        return pastor ? pastor.name : 'Unknown';
      })
      .join(', ');
  }
}