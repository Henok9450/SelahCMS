import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js/auto';
import { AuthService } from '../../../src/app/core/auth.service';
import { Router } from '@angular/router';
import { EventsService } from '../../../src/app/core/events.service';
import { TasksService } from '../../app/core/tasks.service'; // Ensure correct path
import { MatDialog } from '@angular/material/dialog';
import { Event as AppEvent } from '../../../src/app/core/events.model';
import { Task } from '../../app/core/tasks.model'; // Ensure correct path
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { Timestamp } from '@angular/fire/firestore';
import { MembersService } from '../../app/core/members.service';
import { AttendanceService } from '../../app/core/attendance.service';
import { takeUntil, filter } from 'rxjs/operators'; // Import filter
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

interface AttendanceRecord {
  id?: string;
  date: Timestamp | Date | string;
  hiyawMahiderId?: string;
  members?: {
    userId: string;
    status?: 'present' | 'absent' | 'excused' | 'late' | 'new-guest' | 'follow-up-needed';
    [key: string]: any;
  }[];
  [key: string]: any;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatListModule,
  ],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('progressChart') progressChartRef!: ElementRef;
  @ViewChild('attendanceChart') attendanceChartRef!: ElementRef;
  private attendanceChart: Chart | null = null;
  private progressChart: Chart | null = null;
  private unsubscribe$ = new Subject<void>(); // Used for general subscriptions
  private destroy$ = new Subject<void>();    // Used for subscriptions that need to be destroyed on ngOnDestroy

  // Widget visibility
  showEventsWidget: boolean = true;
  showTasksWidget: boolean = true;
  showAttendanceWidget: boolean = true;

  // User info
  userName: string = 'Guest';
  userRole: string = '';
  assignedHiyawMahider: string = '';
  welcomeMessage: string = '';

  // Quick stats
  memberCount: number = 0;
  upcomingEventsCount: number = 2;

  // Recent events
  recentEvents: AppEvent[] = [];
  selectedEvent: AppEvent | null = null;

  // Recent tasks (will be populated based on role from contextualTasks$)
  recentTasks: Task[] = [];
  selectedTask: Task | null = null;

  // Learning progress
  progressPercentage: number = 0;
  daysActive: number = 0;

  attendanceData: { [key: string]: number } = {
    present: 0,
    absent: 0,
    excused: 0,
    late: 0,
    'new-guest': 0,
    'follow-up-needed': 0,
  };

  private rawAttendanceRecords: { date: Timestamp | Date | string; [key: string]: any }[] = [];

  attendanceStatuses: string[] = ['present', 'absent', 'excused', 'late', 'new-guest', 'follow-up-needed'];
  attendanceChartColors: string[] = ['#4CAF50', '#F44336', '#FFEB3B', '#FF9800', '#2196F3', '#9C27B0'];

  // Menu visibility based on role
  showMembersMenu: boolean = true;
  showTasksMenu: boolean = true;
  showusermanagementMenu: boolean = true;
  showEventsMenu: boolean = true;
  showProgressMenu: boolean = true;
  showReportsMenu: boolean = true;
  showMaterialsMenu: boolean = true;
  showCertificatesMenu: boolean = true;
  showAdminMenu: boolean = true;

  // Widget visibility
  showQuickStats: boolean = true;
  showProgressWidget: boolean = true;
  showAnnouncementsWidget: true = true;

  // Events configuration
  eventsConfig = {
    showWidget: true,
    maxItems: 10,
    showLocation: true,
    showDate: true,
    showDescription: false,
    customFields: [] as { name: string; visible: boolean }[],
  };

  // Tasks configuration
  tasksConfig = {
    showWidget: true,
    maxItems: 10,
    showDueDate: true,
    showStatus: true,
    showPriority: false,
    customFields: [] as { name: string; visible: boolean }[],
  };

  constructor(
    private authService: AuthService,
    public router: Router,
    private eventsService: EventsService,
    private tasksService: TasksService,
    private membersService: MembersService,
    private attendanceService: AttendanceService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    Chart.register(...registerables);
    this.loadMaterialIcons();
  }

  ngOnInit(): void {
    console.log('HomeComponent ngOnInit called.');
    this.setRoleBasedPermissions();
    this.loadEvents(); // Events loading logic is fine as it is
    this.loadCustomConfigurations();

    // Subscribe to contextualTasks$ from the TasksService
    // This observable already incorporates the role and Hiyaw Mahider ID filtering
    this.tasksService.contextualTasks$.pipe(
  takeUntil(this.destroy$)
).subscribe(
  (tasks: Task[]) => {
    console.log('--- Raw tasks received from TasksService.contextualTasks$ (before component-level filtering): ---');
    console.log(tasks);

    const now = new Date();
    console.log('Current Date/Time for filtering:', now);

    this.recentTasks = tasks
      .filter(task => {
        const dueDate = task.dueDate instanceof Timestamp
          ? task.dueDate.toDate()
          : task.dueDate;

        // Only show tasks that are pending or in progress
        const isActiveTask = (task.status === 'pending' || task.status === 'in_progress');
        
        // For tasks with due dates, only show if not yet passed
        const isFutureDueDate = dueDate instanceof Date && dueDate > now;
        const hasNoDueDate = !task.dueDate;

        return isActiveTask && (hasNoDueDate || isFutureDueDate);
      })
          .sort((a, b) => {
           
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            let dateA: Date | null = null;
            if (a.dueDate instanceof Timestamp) {
              dateA = a.dueDate.toDate();
            } else if (a.dueDate instanceof Date) {
              dateA = a.dueDate;
            } else if (typeof a.dueDate === 'string') {
              const parsedDate = new Date(a.dueDate);
              if (!isNaN(parsedDate.getTime())) {
                dateA = parsedDate;
              } else {
                console.warn(`[HomeComponent] Could not parse dueDate string for task ${a.id || a.title}: ${a.dueDate}. Treating as no date.`);
              }
            } else {
              console.warn(`[HomeComponent] Unexpected type for dueDate for task ${a.id || a.title}: ${typeof a.dueDate}. Value: ${a.dueDate}. Treating as no date.`);
            }

            let dateB: Date | null = null;
            if (b.dueDate instanceof Timestamp) {
              dateB = b.dueDate.toDate();
            } else if (b.dueDate instanceof Date) {
              dateB = b.dueDate;
            } else if (typeof b.dueDate === 'string') {
              const parsedDate = new Date(b.dueDate);
              if (!isNaN(parsedDate.getTime())) {
                dateB = parsedDate;
              } else {
                console.warn(`[HomeComponent] Could not parse dueDate string for task ${b.id || b.title}: ${b.dueDate}. Treating as no date.`);
              }
            } else {
              console.warn(`[HomeComponent] Unexpected type for dueDate for task ${b.id || b.title}: ${typeof b.dueDate}. Value: ${b.dueDate}. Treating as no date.`);
            }

            if (dateA === null && dateB === null) return 0;
            if (dateA === null) return 1;
            if (dateB === null) return -1;

            return dateA.getTime() - dateB.getTime();
          });

        console.log('--- Tasks after component-level filtering and sorting for display: ---');
        console.log(this.recentTasks);
        this.cdr.detectChanges(); 
      },
      (error: any) => console.error('Error loading tasks:', error)
    );
  }

  ngAfterViewInit(): void {
    console.log('HomeComponent ngAfterViewInit called.');
    // Ensure charts are rendered after data is available and view is initialized
    // Initial call to render progress chart
    this.renderProgressChart();
    // Initial call to initialize attendance chart (will be updated by loadAttendanceData)
    this.initializeAttendanceChart();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.destroy$.next();
    this.destroy$.complete();

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
      this.attendanceChart = null;
    }
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
    console.log('HomeComponent ngOnDestroy called. Charts and subscriptions destroyed.');
  }

  private initializeAttendanceChart(): void {
    console.log('initializeAttendanceChart called.');
    if (!this.attendanceChartRef?.nativeElement) {
      console.error('Attendance chart element not found in initializeAttendanceChart.');
      return;
    }

    const ctx = this.attendanceChartRef.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context in initializeAttendanceChart.');
      return;
    }

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }

    // Initialize with dummy data or zeros if no real data is ready yet
    // updateAttendanceChart will be called later with real data
    this.attendanceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.attendanceStatuses.map(status =>
          status.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' ')),
        datasets: [{
          data: this.attendanceStatuses.map(status => this.attendanceData[status]),
          backgroundColor: this.attendanceChartColors,
          borderWidth: 1,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#333',
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.label || '';
                if (label) label += ': ';
                if (context.parsed) label += `${context.parsed} members`;
                return label;
              }
            }
          }
        }
      }
    });
    console.log('Attendance chart initialized (may be with initial zeros).');
  }

  private loadMaterialIcons(): void {
    if (!document.querySelector('link[href="https://fonts.googleapis.com/icon?family=Material+Icons"]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }

  private setRoleBasedPermissions(): void {
    console.log('setRoleBasedPermissions called.');
    this.authService.authState$.pipe(takeUntil(this.unsubscribe$)).subscribe((user) => {
      if (user && user.uid) {
        console.log('User is authenticated. UID:', user.uid);
        this.authService.getUserData(user.uid).then((userData) => {
          if (userData) {
            this.userRole = userData.role;
            this.userName = userData.displayName;
            this.assignedHiyawMahider = userData.assignedHiyawMahiderName;

            console.log('Fetched User Data:', {
              role: this.userRole,
              name: this.userName,
              hiyawMahiderId: userData.assignedHiyawMahiderId,
              hiyawMahiderName: this.assignedHiyawMahider
            });

            this.setWelcomeMessage();

            // Default permissions for non-admin/pastor are stricter
            this.showAdminMenu = false; // Default to false
            this.showReportsMenu = false; // Default to false
            this.eventsConfig.showDescription = false; // Default to false
            this.tasksConfig.showPriority = false; // Default to false
            this.showusermanagementMenu = false; // Default to false
            this.showAttendanceWidget = false; // Default to false

            // Always update TasksService with current user's role and HiyawMahiderId
            this.tasksService.setCurrentUserRole(this.userRole);
            this.tasksService.setCurrentUserHiyawMahiderId(userData.assignedHiyawMahiderId || null);

            if (this.userRole === 'Admin') {
              console.log('User role is Admin.');
              this.showAdminMenu = true;
              this.showReportsMenu = true;
              this.showusermanagementMenu = true;
              this.eventsConfig.showDescription = true;
              this.tasksConfig.showPriority = true;
              this.showAttendanceWidget = true;
            
              // Admin might see all members, or members in their main mahider if assigned
              if (userData.assignedHiyawMahiderId && user?.uid) {
                this.loadMemberCount(userData.assignedHiyawMahiderId);
                this.loadAttendanceData(userData.assignedHiyawMahiderId, user.uid);
              } else {
                // Admins might not have a primary Mahider, or see all data
                // For now, if no mahider, memberCount/attendance will be 0 or global (if implemented)
                this.memberCount = 0; // Or fetch total members if desired
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            }else if (this.userRole === 'Pastor' || this.userRole === 'Deputy Pastor') {
              console.log(`User role is ${this.userRole}. Fetching data for assigned Hiyaw Mahider.`);
              this.showReportsMenu = true;
              this.eventsConfig.showDescription = true;
              this.showAttendanceWidget = true;
              this.showusermanagementMenu = true; // Pastor/Deputy Pastor might manage users

              if (userData.assignedHiyawMahiderId && user.uid) {
                this.loadMemberCount(userData.assignedHiyawMahiderId as string);
                this.loadAttendanceData(userData.assignedHiyawMahiderId as string, user.uid);
              } else {
                console.warn(`${this.userRole} user has no assigned Hiyaw Mahider ID. Displaying general data or zeros.`);
                this.memberCount = 0;
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            } else if (this.userRole === 'Member') {
              console.log('User role is Member.');
              this.showAdminMenu = false;
              this.showReportsMenu = false;
              this.showusermanagementMenu = false;
              this.memberCount = 0; // Members don't typically see total member count
              this.showAttendanceWidget = true; // Members can see their own attendance

              if (userData.assignedHiyawMahiderId && user.uid) {
                console.log('Member role: Calling loadAttendanceData for user:', user.uid, 'in Hiyaw Mahider:', userData.assignedHiyawMahiderId);
                this.loadAttendanceData(userData.assignedHiyawMahiderId as string, user.uid);
              } else {
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            } else {
              console.log('User role is not Member, Pastor, Deputy Pastor, or Admin. Defaulting permissions.');
              // This block covers roles like 'Guest' or undefined roles
              if (userData.assignedHiyawMahiderId && user.uid) {
                console.log('Default role, but found Hiyaw Mahider ID. Loading data for user:', user.uid, 'in Hiyaw Mahider:', userData.assignedHiyawMahiderId);
                this.loadMemberCount(userData.assignedHiyawMahiderId as string);
                this.loadAttendanceData(userData.assignedHiyawMahiderId as string, user.uid);
              } else {
                console.warn('Default role user has no assigned Hiyaw Mahider ID. Displaying general data or zeros.');
                this.memberCount = 0;
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            }
            this.cdr.detectChanges();
          } else {
            console.warn('User data not found for authenticated user.');
            this.resetUserDataAndPermissions();
          }
        }).catch((error) => {
          console.error('Error fetching user data:', error);
          this.resetUserDataAndPermissions();
        });
      } else {
        console.log('User is not authenticated (Guest).');
        this.resetUserDataAndPermissions();
      }
    });
  }

  private resetUserDataAndPermissions(): void {
    this.userRole = 'Guest';
    this.userName = 'Guest';
    this.assignedHiyawMahider = '';
    this.setWelcomeMessage();
    this.initializeEmptyAttendanceData();
    this.calculateLearningProgressAndDaysActive([]);

    this.showAdminMenu = false;
    this.showReportsMenu = false;
    this.showusermanagementMenu = false;
    this.memberCount = 0;
    this.eventsConfig.showDescription = false;
    this.tasksConfig.showPriority = false;
    this.showAttendanceWidget = false; // Guests don't see attendance widget

    // Clear TasksService role/hiyawMahiderId for guests
    this.tasksService.setCurrentUserRole(null);
    this.tasksService.setCurrentUserHiyawMahiderId(null);
    this.cdr.detectChanges();
  }


  private loadAttendanceData(hiyawMahiderId: string, userId: string): void {
    console.log('loadAttendanceData called for Hiyaw Mahider ID:', hiyawMahiderId, 'and User ID:', userId);

    this.attendanceService.getAttendanceCountsByHiyawMahider(hiyawMahiderId, userId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result: {
        present?: number;
        absent?: number;
        excused?: number;
        late?: number;
        'new-guest'?: number;
        'follow-up-needed'?: number;
        rawRecords?: any[];
      }) => {
        console.log('Raw attendance data received from service for user:', result);

        this.attendanceData = {
          present: result['present'] || 0,
          absent: result['absent'] || 0,
          excused: result['excused'] || 0,
          late: result['late'] || 0,
          'new-guest': result['new-guest'] || 0,
          'follow-up-needed': result['follow-up-needed'] || 0,
        };
        console.log('Processed attendanceData for chart (for logged-in user):', this.attendanceData);
        this.updateAttendanceChart();

        this.rawAttendanceRecords = result['rawRecords'] || [];
        console.log('Raw attendance records for days active calculation:', this.rawAttendanceRecords);

        this.calculateLearningProgressAndDaysActive(this.rawAttendanceRecords);

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading attendance for user:', userId, err);
        this.initializeEmptyAttendanceData();
        this.calculateLearningProgressAndDaysActive([]);
      }
    });
  }

  private loadMemberCount(hiyawMahiderId: string): void {
    console.log('loadMemberCount called for ID:', hiyawMahiderId);
    this.membersService.getMemberCountByHiyawMahider(hiyawMahiderId).pipe(takeUntil(this.unsubscribe$)).subscribe(
      (count: number) => {
        this.memberCount = count;
        console.log('Member count received:', this.memberCount);
      },
      (error) => {
        console.error('Error fetching member count:', error);
        this.memberCount = 0;
      }
    );
  }

  private updateAttendanceChart(): void {
    console.log('updateAttendanceChart called with current data:', this.attendanceData);

    if (!this.attendanceChartRef?.nativeElement) {
      console.error('Attendance chart element not found');
      return;
    }

    const ctx = this.attendanceChartRef.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }

    const labels = [];
    const data = [];
    const backgroundColors = [];

    this.attendanceStatuses.forEach((status, index) => {
      const count = this.attendanceData[status];
      if (count > 0) {
        labels.push(this.formatStatusLabel(status));
        data.push(count);
        backgroundColors.push(this.attendanceChartColors[index]);
      }
    });

    if (data.length === 0) {
      labels.push('No Attendance Data');
      data.push(1);
      backgroundColors.push('#e0e0e0');
    }

    this.attendanceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#333',
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw || 0;
                return `${label}: ${value} ${value === 1 ? 'record' : 'records'}`;
              }
            }
          }
        }
      }
    });

    console.log('Attendance chart updated with actual data.');
  }

  getProgressCalculationDetails(): string {
    return `Progress: ${this.progressPercentage}% (${this.daysActive} days active in last 3 months)`;
  }

  private formatStatusLabel(status: string): string {
    return status.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private initializeEmptyAttendanceData(): void {
    console.log('initializeEmptyAttendanceData called.');
    this.attendanceData = {
      present: 0,
      absent: 0,
      excused: 0,
      late: 0,
      'new-guest': 0,
      'follow-up-needed': 0
    };
    this.cdr.detectChanges();
    this.updateAttendanceChart();
  }

  private setWelcomeMessage(): void {
    if (this.userName && this.assignedHiyawMahider) {
      this.welcomeMessage = `${this.userName}, welcome back to ${this.assignedHiyawMahider}!`;
    } else if (this.userName) {
      this.welcomeMessage = `Welcome back, ${this.userName}!`;
    } else {
      this.welcomeMessage = 'Welcome!';
    }
  }

  private loadCustomConfigurations(): void {
    const savedEventsConfig = localStorage.getItem('eventsWidgetConfig');
    const savedTasksConfig = localStorage.getItem('tasksWidgetConfig');

    if (savedEventsConfig) {
      this.eventsConfig = { ...this.eventsConfig, ...JSON.parse(savedEventsConfig) };
    }

    if (savedTasksConfig) {
      this.tasksConfig = { ...this.tasksConfig, ...JSON.parse(savedTasksConfig) };
    }
  }

 private loadEvents(): void {
  this.eventsService.getEvents().pipe(takeUntil(this.unsubscribe$)).subscribe(
    (events: AppEvent[]) => {
      const now = new Date();
      this.recentEvents = events
        .filter(event => {
          const startDate = event.date instanceof Timestamp ? event.date.toDate() : event.date;
          const endDate = event.endDate instanceof Timestamp ? event.endDate.toDate() : event.endDate;

          // If there's an end date, check if it's in the future
          if (endDate) {
            return endDate > now;
          }
          
          // If no end date, just check the start date
          return startDate > now;
        })
        .sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.toDate() : a.date;
          const dateB = b.date instanceof Timestamp ? b.date.toDate() : b.date;
          return dateA.getTime() - dateB.getTime();
        });

      this.upcomingEventsCount = this.recentEvents.length;
    },
    (error: any) => console.error('Error loading events', error)
  );
}

  // --- REMOVED loadTasks() method and replaced with subscription to tasksService.contextualTasks$ in ngOnInit ---
  // The filtering logic for members now primarily resides in the TasksService.

  updateEventsConfig(newConfig: any): void {
    this.eventsConfig = { ...this.eventsConfig, ...newConfig };
    localStorage.setItem('eventsWidgetConfig', JSON.stringify(this.eventsConfig));
    this.loadEvents();
  }

  updateTasksConfig(newConfig: any): void {
    this.tasksConfig = { ...this.tasksConfig, ...newConfig };
    localStorage.setItem('tasksWidgetConfig', JSON.stringify(this.tasksConfig));
    // No need to call loadTasks() here, as the subscription in ngOnInit will react to changes
    // in TasksService's internal state (triggered by setRoleBasedPermissions)
  }

  private renderProgressChart(): void {
    if (!this.progressChartRef?.nativeElement) return;

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.progressChart) {
      this.progressChart.destroy();
    }

    this.progressChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Quarterly Progress', 'Remaining'],
        datasets: [{
          data: [this.progressPercentage, 100 - this.progressPercentage],
          backgroundColor: ['#4CAF50', '#E0E0E0'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `Quarterly Progress: ${this.progressPercentage.toFixed(2)}%`;
              }
            }
          }
        }
      },
    });
  }
  private calculateLearningProgressAndDaysActive(rawRecords: AttendanceRecord[]): void {
    console.log('calculateLearningProgressAndDaysActive called with raw records:', rawRecords);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get current user ID from auth state
    this.authService.authState$.pipe(
      takeUntil(this.destroy$),
      first(user => user !== null) // Wait until we have a user
    ).subscribe(user => {
      if (!user) {
        console.log('No authenticated user, skipping progress calculation');
        this.progressPercentage = 0;
        this.daysActive = 0;
        this.renderProgressChart();
        this.cdr.detectChanges();
        return;
      }

      const currentUserId = user.uid;
      console.log('Calculating progress for user:', currentUserId);

      // Filter records from last 3 months where the current user is listed
      const userRecords = rawRecords.filter(record => {
        if (!record['date']) return false;

        // Parse record date
        let recordDate: Date;
        if (record['date'] instanceof Timestamp) {
          recordDate = record['date'].toDate();
        } else if (record['date'] instanceof Date) {
          recordDate = record['date'];
        } else {
          recordDate = new Date(record['date']);
          if (isNaN(recordDate.getTime())) return false;
        }

        // Check if date is within last 3 months AND user is in members list
        return recordDate >= threeMonthsAgo && 
               record.members?.some(m => m['userId'] === currentUserId);
      });

      console.log('User records (last 3 months):', userRecords.length);

      let presentCount = 0;
      const totalOpportunities = userRecords.length;

      userRecords.forEach(record => {
        const userMember = record.members?.find(m => m['userId'] === currentUserId);
        if (userMember) {
          // Count as present if status is present, late, or new-guest
          const status = userMember['status'] || userMember['attendanceStatus'];
          if (status === 'present' || status === 'late' || status === 'new-guest') {
            presentCount++;
          }
        }
      });

      // Calculate progress percentage
      this.progressPercentage = totalOpportunities > 0
        ? parseFloat(((presentCount / totalOpportunities) * 100).toFixed(2))
        : 0;

      // Count unique active days
      const uniqueDates = new Set<string>();
      userRecords.forEach(record => {
        if (record['date']) {
          let date: Date;
          if (record['date'] instanceof Timestamp) {
            date = record['date'].toDate();
          } else if (record['date'] instanceof Date) {
            date = record['date'];
          } else {
            date = new Date(record['date']);
            if (isNaN(date.getTime())) return;
          }
          uniqueDates.add(date.toISOString().split('T')[0]);
        }
      });

      this.daysActive = uniqueDates.size;

      console.log(`User Progress Calculation:
        User ID: ${currentUserId}
        Present Count: ${presentCount}
        Total Opportunities: ${totalOpportunities}
        Progress Percentage: ${this.progressPercentage}%`);
      console.log(`Days Active: ${this.daysActive}`);

      this.renderProgressChart();
      this.cdr.detectChanges();
    });
}

  openTaskDetails(task: Task): void {
    this.selectedTask = task;
    console.log('Selected task:', this.selectedTask);
  }

  closeTaskDetails(): void {
    this.selectedTask = null;
  }

  openEventDetails(event: AppEvent): void {
    this.selectedEvent = event;
    console.log('Event clicked:', event);
    console.log('selectedEvent is now:', this.selectedEvent);
  }

  closeEventDetails(): void {
    this.selectedEvent = null;
  }

  canModifyContent(): boolean {
    // Only Admin can create tasks/events currently
    return this.userRole === 'Admin';
  }

  createEvent(): void {
    if (this.canModifyContent()) {
      this.router.navigate(['pages/events/new']);
    } else {
      console.warn('User does not have permission to create events.');
      // Optionally, show a message to the user
    }
  }

  createTask(): void {
    if (this.canModifyContent()) {
      this.router.navigate(['pages/tasks/new']);
    } else {
      console.warn('User does not have permission to create tasks.');
      // Optionally, show a message to the user
    }
  }

  viewProfile(): void {
    this.router.navigate(['/profile']);
  }

  changePassword(): void {
    this.router.navigate(['/change-password']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  viewProgressDetails(): void {
    this.router.navigate(['/progress']);
  }

  viewAllAnnouncements(): void {
    this.router.navigate(['/announcements']);
  }

  getFormattedDate(date: Date | Timestamp): Date {
    return date instanceof Timestamp ? date.toDate() : date;
  }

  getTotalAttendance(): number {
    return this.attendanceStatuses.reduce(
      (total, status) => total + (this.attendanceData[status] || 0),
      0
    );
  }

  formatTaskStatus(status: 'pending' | 'in_progress' | 'completed' | string): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'in_progress':
        return 'In Progress';
      default:
        return status;
    }
  }
}