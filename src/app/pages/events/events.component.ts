import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';

import { EventsService } from '../../core/events.service';
import { Event } from '../../core/events.model';
import { PastorService } from '../../core/pastor.service';
import { Pastor } from '../../core/pastor.model';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Subject, of, Observable } from 'rxjs';
import { takeUntil, switchMap, catchError, tap } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';
import { convertToDate } from '../Utility/date.utils';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatToolbarModule,
  ],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
})
export class EventsComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  isLoading = false;
  minDate = new Date(); // Sets min date for date pickers to today
  @ViewChild('eventForm') eventForm!: NgForm;
  @ViewChild(MatPaginator) paginator!: MatPaginator; // Reference to MatPaginator

  // Helper for direct date conversion in template (if needed)
  safeDate(value: string | Date | Timestamp | undefined): Date | null {
    return convertToDate(value);
  }

  // Display time only (e.g., "10:30 AM")
  displayTime(value: string | Date | Timestamp | undefined): string {
    const date = convertToDate(value);
    return date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
  }

  // Display date only (e.g., "Jul 1, 2025")
  displayDate(value: string | Date | Timestamp | undefined): string {
    const date = convertToDate(value);
    if (!date) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Event data
  events: Event[] = [];
  // Use MatTableDataSource for automatic filtering and pagination
  dataSource = new MatTableDataSource<Event>([]);
  currentEvent: Event = this.createEmptyEvent();

  // Supporting data
  pastors: Pastor[] = [];
  eventTypes = [
    { value: 'group-study', label: 'Group Study Session' },
    { value: 'prayer-meeting', label: 'Prayer Meeting' },
    { value: 'church-gathering', label: 'Church Gathering' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'other', label: 'Other' },
  ];

  // UI state
  mode: 'list' | 'view' | 'create' | 'edit' = 'list';
  selectedTab = 'all';
  selectedPastorId = '';
  userRole = '';
  currentUserId: string | null = null;

  // Mat-Table properties
  displayedColumns: string[] = [
    'title',
    'type',
    'dateRange',
    'location',
    'assignedPastors',
    'actions',
  ];

  constructor(
    private eventsService: EventsService,
    private pastorsService: PastorService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.authService.authState$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      const userId = user?.uid || '';
      this.currentUserId = userId;
      if (userId) {
        this.authService
          .getUserData(userId)
          .then((userData) => {
            this.userRole = userData?.role || '';
            this.initializeComponent();
          })
          .catch(() => {
            this.userRole = '';
            this.initializeComponent();
          });
      } else {
        this.userRole = '';
        this.initializeComponent();
      }
    });
  }

  ngAfterViewInit() {
    // Only set paginator if in 'list' mode, otherwise it might not exist
    if (this.mode === 'list') {
      this.dataSource.paginator = this.paginator;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const eventId = params.get('id');
          const routeMode = this.route.snapshot.data['mode'];

          if (eventId) {
            this.mode =
              this.route.snapshot.queryParamMap.get('edit') === 'true' ? 'edit' : 'view';
            return this.loadEvent(eventId);
          } else if (routeMode === 'create') {
            this.mode = 'create';
            this.currentEvent = this.createEmptyEvent(); // Ensure correct initialization for create mode
            return of(null);
          } else {
            this.mode = 'list';
            return this.loadEvents();
          }
        }),
        catchError((error) => {
          this.snackBar.open('Error loading data: ' + error.message, 'Close', { duration: 5000 });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadPastors();
      });
  }

  private createEmptyEvent(): Event {
    const now = new Date();
    const defaultStartTime = now.toTimeString().slice(0, 5);
    const defaultEndTime = new Date(now.getTime() + 3600000).toTimeString().slice(0, 5);

    return {
      title: '',
      description: '',
      type: 'other',
      startDateTime: now,
      endDate: new Date(now.getTime() + 3600000),
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      location: '',
      assignedPastors: [],
      createdBy: this.currentUserId || '',
      createdAt: now,
      date: now,
      isCompleted: false,
      recurrence: 'none',
    };
  }

  private loadEvents(): Observable<Event[]> {
    this.isLoading = true;
    return this.eventsService.getEvents().pipe(
      takeUntil(this.destroy$),
      catchError((error) => {
        this.isLoading = false;
        this.snackBar.open('Error loading events: ' + error.message, 'Close', {
          duration: 5000,
        });
        return of([]);
      }),
      tap((events) => {
        this.events = events.map((event) => ({
          ...event,
          startDateTime: convertToDate(event.startDateTime) as Date,
          endDate: convertToDate(event.endDate) as Date,
        }));
        this.dataSource.data = this.events; // Set data to MatTableDataSource
        if (this.paginator) { // Ensure paginator is available before assigning
            this.dataSource.paginator = this.paginator;
        }
        this.applyFilter(); // Apply initial filter
        this.isLoading = false;
      })
    );
  }

  private loadEvent(eventId: string): Observable<Event | null> {
    this.isLoading = true;
    return this.eventsService.getEvent(eventId).pipe(
      takeUntil(this.destroy$),
      catchError((error) => {
        this.isLoading = false;
        this.snackBar.open('Error loading event: ' + error.message, 'Close', {
          duration: 5000,
        });
        return of(null);
      }),
      tap((event: Event | null) => {
        if (event) {
          const loadedStartDateTime = convertToDate(event.startDateTime);
          const loadedEndDateTime = convertToDate(event.endDate);

          this.currentEvent = {
            ...event,
            startDateTime: loadedStartDateTime as Date,
            endDate: loadedEndDateTime as Date,
            startTime: loadedStartDateTime ? loadedStartDateTime.toTimeString().slice(0, 5) : '',
            endTime: loadedEndDateTime ? loadedEndDateTime.toTimeString().slice(0, 5) : '',
          };
        }
        this.isLoading = false;
      })
    );
  }

  private loadPastors() {
    this.pastorsService
      .getPastors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((pastors) => {
        this.pastors = pastors;
      });
  }

  applyFilter() {
    this.dataSource.filterPredicate = (data: Event, filter: string) => {
      // Custom filter logic
      const searchTerms = JSON.parse(filter);

      const matchesPastor = searchTerms.pastorId
        ? data.assignedPastors?.includes(searchTerms.pastorId)
        : true;

      // Add more filtering logic here if needed (e.g., by tab selection)
      // For now, the 'All' tab implies no further type filtering.
      // If you had 'Upcoming' or 'Completed' tabs, you'd add:
      // const matchesTab = searchTerms.tab === 'all' || (searchTerms.tab === 'upcoming' && !data.isCompleted) || (searchTerms.tab === 'completed' && data.isCompleted);

      return matchesPastor; // && matchesTab;
    };

    const filterValue = {
      pastorId: this.selectedPastorId,
      tab: this.selectedTab, // Include tab in filter value if needed for more complex filtering
    };

    this.dataSource.filter = JSON.stringify(filterValue);

    // If you want to reset paginator to first page after filter
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onTabChange(tab: string) {
    this.selectedTab = tab.toLowerCase();
    this.applyFilter();
  }

  onPastorSelect(pastorId: string) {
    this.selectedPastorId = pastorId;
    this.applyFilter();
  }

  viewEvent(eventId: string) {
    this.router.navigate(['pages/events', eventId]);
  }

  createNewEvent() {
    this.router.navigate(['pages/events/new']);
  }

  editEvent(id: string) {
    console.log('Editing event ID:', id);
    if (!id) {
      console.error('No event ID provided for editing');
      this.snackBar.open('Error: No event ID provided', 'Close', { duration: 3000 });
      return;
    }
    this.router.navigate(['pages/events', id], {
      queryParams: { edit: true },
      state: { currentEvent: this.currentEvent },
    });
  }

  saveEvent(): void {
    if (
      !this.eventForm.valid ||
      !this.currentEvent.startDateTime ||
      !this.currentEvent.endDate ||
      !this.currentEvent.startTime ||
      !this.currentEvent.endTime
    ) {
      this.snackBar.open('Please fill all required date and time fields.', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isLoading = true;

    try {
      const startDateFromPicker = convertToDate(this.currentEvent.startDateTime);
      const endDateFromPicker = convertToDate(this.currentEvent.endDate);

      if (!startDateFromPicker || !endDateFromPicker) {
        this.snackBar.open('Invalid date values.', 'Close', { duration: 5000 });
        this.isLoading = false;
        return;
      }

      const startTimeParts = this.currentEvent.startTime!.split(':');
      const endTimeParts = this.currentEvent.endTime!.split(':');

      const combinedStartDateTime = new Date(startDateFromPicker.getTime());
      combinedStartDateTime.setHours(
        parseInt(startTimeParts[0], 10),
        parseInt(startTimeParts[1], 10),
        0,
        0
      );

      const combinedEndDateTime = new Date(endDateFromPicker.getTime());
      combinedEndDateTime.setHours(
        parseInt(endTimeParts[0], 10),
        parseInt(endTimeParts[1], 10),
        0,
        0
      );

      if (combinedStartDateTime > combinedEndDateTime) {
        this.snackBar.open('End date and time must be after start date and time.', 'Close', {
          duration: 5000,
        });
        this.isLoading = false;
        return;
      }

      const eventData: Partial<Event> = {
        ...this.currentEvent,
        startDateTime: combinedStartDateTime,
        endDate: combinedEndDateTime,
        updatedAt: new Date(),
      };

      delete eventData.startTime;
      delete eventData.endTime;

      const operation =
        this.mode === 'create'
          ? this.eventsService.createEvent(eventData)
          : this.eventsService.updateEvent(this.currentEvent.id || '', eventData);

      operation
        .then(() => {
          this.snackBar.open(
            `Event ${this.mode === 'create' ? 'created' : 'updated'}!`,
            'Close',
            { duration: 3000 }
          );
          this.router.navigate(['pages/events']);
        })
        .catch((error) => {
          console.error('Error saving event:', error);
          this.snackBar.open(
            'Error saving event. Please check inputs and try again.',
            'Close',
            { duration: 5000 }
          );
        })
        .finally(() => {
          this.isLoading = false;
        });
    } catch (error) {
      this.isLoading = false;
      this.snackBar.open(
        'An unexpected error occurred during date/time processing. Please check values.',
        'Close',
        { duration: 5000 }
      );
      console.error('Date processing error:', error);
    }
  }

  deleteEvent(eventId: string) {
    if (confirm('Are you sure you want to delete this event?')) {
      this.isLoading = true;
      this.eventsService
        .deleteEvent(eventId)
        .then(() => {
          this.snackBar.open('Event deleted successfully!', 'Close', { duration: 3000 });
          this.router.navigate(['pages/events']);
        })
        .catch((error) => {
          this.snackBar.open('Error deleting event: ' + error.message, 'Close', {
            duration: 5000,
          });
        })
        .finally(() => {
          this.isLoading = false;
        });
    }
  }

  cancel() {
    this.router.navigate(['pages/events']);
  }

  canModifyContent(): boolean {
    return ['Admin', 'Pastor', 'Deputy Pastor'].includes(this.userRole);
  }

  getEventTypeLabel(type: string): string {
    return this.eventTypes.find((t) => t.value === type)?.label || type;
  }

  // FIX APPLIED HERE
  getAssignedPastorsNames(assignedPastors: string[] | undefined): string {
    if (!assignedPastors || assignedPastors.length === 0) {
      return 'None assigned';
    }

    const names = assignedPastors
      .map((id) => this.pastors.find((p) => p.id === id)?.name)
      // Use a type guard to explicitly filter out undefined/null and narrow the type to string[]
      .filter((name): name is string => typeof name === 'string' && name !== null && name !== undefined);

    // Now 'names' is definitively a string[], so .join() is safe.
    return names.join(', ');
  }

  /**
   * Truncates a string to a maximum length and appends '...' if truncated.
   * Provides a default message if the description is null, undefined, or empty.
   * @param description The event description string.
   * @returns The truncated description or a default message.
   */
  getTruncatedDescription(description: string | undefined | null): string {
    if (!description) {
      return 'No description provided.';
    }
    const maxLength = 100; // As per your original logic
    return description.length > maxLength ? description.slice(0, maxLength) + '...' : description;
  }


  validateDates(): void {
    if (
      !this.currentEvent.startDateTime ||
      !this.currentEvent.endDate ||
      !this.currentEvent.startTime ||
      !this.currentEvent.endTime
    ) {
      return;
    }

    const startDateFromPicker = convertToDate(this.currentEvent.startDateTime);
    const endDateFromPicker = convertToDate(this.currentEvent.endDate);

    if (!startDateFromPicker || !endDateFromPicker) {
      return;
    }

    const startDate = new Date(startDateFromPicker.getTime());
    const startTimeParts = this.currentEvent.startTime.split(':');
    startDate.setHours(parseInt(startTimeParts[0], 10), parseInt(startTimeParts[1], 10));

    const endDate = new Date(endDateFromPicker.getTime());
    const endTimeParts = this.currentEvent.endTime.split(':');
    endDate.setHours(parseInt(endTimeParts[0], 10), parseInt(endTimeParts[1], 10));

    if (startDate > endDate) {
      this.snackBar.open('End date/time must be after start date/time', 'Close', { duration: 3000 });
    }
  }

  displayEventDateRange(event: Event): string {
    const start = convertToDate(event.startDateTime);
    const end = convertToDate(event.endDate);

    if (!start || !end) return 'Date not specified';

    const isSameDay =
      start.getDate() === end.getDate() &&
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();

    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };

    if (isSameDay) {
      return `${start.toLocaleDateString('en-US', dateOptions)}, ${start.toLocaleTimeString(
        'en-US',
        timeOptions
      )} - ${end.toLocaleTimeString('en-US', timeOptions)}`;
    } else {
      return `${start.toLocaleDateString('en-US', dateOptions)}, ${start.toLocaleTimeString(
        'en-US',
        timeOptions
      )} - ${end.toLocaleDateString('en-US', dateOptions)}, ${end.toLocaleTimeString(
        'en-US',
        timeOptions
      )}`;
    }
  }
}