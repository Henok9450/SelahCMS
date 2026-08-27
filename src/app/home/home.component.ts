import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js/auto';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { Timestamp } from '@angular/fire/firestore';
import { Subject } from 'rxjs';
import { takeUntil, filter, first, take } from 'rxjs/operators';

import { AuthService } from '../core/services/auth.service';
import { EventsService } from '../core/services/events.service';
import { TasksService } from '../core/services/tasks.service';
import { AttendanceService } from '../core/services/attendance.service';
import { MemberService } from '../core/services/member.service';
import { Event as AppEvent } from '../core/models/events.model';
import { Task } from '../core/models/tasks.model';
import { AttendanceDetailsDialogComponent } from './attendance-details-dialog.component';
import { hasPermission, AppRole, ROLE_PERMISSIONS } from '../core/utils/role.utils';

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

import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    MatCardModule,
    MatTooltipModule,
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


  // Loading state
  isLoading: boolean = true;

  // User info
  userName: string = 'Guest';
  userRole: string = '';
  assignedHiyawMahider: string = '';


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
  presentCount: number = 0;
  totalOpportunities: number = 0;

  attendanceData: { [key: string]: number } = {
    present: 0,
    absent: 0,
    excused: 0,
    late: 0,
    'new-guest': 0,
    'follow-up-needed': 0,
  };

  private rawAttendanceRecords: { date: Timestamp | Date | string;[key: string]: any }[] = [];

  attendanceStatuses: string[] = ['present', 'absent', 'excused', 'late', 'new-guest', 'follow-up-needed'];
  attendanceChartColors: string[] = ['#4CAF50', '#F44336', '#FFEB3B', '#FF9800', '#2196F3', '#9C27B0'];

  // Menu visibility based on role
  showMembersMenu: boolean = true;
  showTasksMenu: boolean = true;
  showEventsMenu: boolean = true;
  showProgressMenu: boolean = true;
  showReportsMenu: boolean = true;
  showMaterialsMenu: boolean = true;
  showCertificatesMenu: boolean = true;
  showAdminMenu: boolean = true;

  // Widget visibility
  showQuickStats: boolean = true;
  showProgressWidget: boolean = true;
  showAnnouncementsWidget: boolean = true;

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
    private memberService: MemberService,
    private attendanceService: AttendanceService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
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



            // Align permissions strictly with the Role Matrix
            this.showAdminMenu = this.hasPermission('admin-logs') || this.userRole === 'Admin';
            this.showReportsMenu = this.hasPermission('reports');
            this.showEventsWidget = this.hasPermission('events');
            this.showTasksWidget = this.hasPermission('tasks');
            this.showAttendanceWidget = this.hasPermission('attendance');
            this.showProgressWidget = this.hasPermission('study-materials');
            this.showMembersMenu = this.hasPermission('members');
            this.eventsConfig.showDescription = ['Admin', 'Pastor', 'Deputy Pastor', 'Zone Coordinator'].includes(this.userRole);
            this.tasksConfig.showPriority = ['Admin', 'Pastor', 'Deputy Pastor', 'Zone Coordinator'].includes(this.userRole);

            // Always update TasksService with current user's role and HiyawMahiderId
            this.tasksService.setCurrentUserRole(this.userRole);
            this.tasksService.setCurrentUserHiyawMahiderId(userData.assignedHiyawMahiderId || null);

            if (this.userRole === 'Admin') {
              console.log('User role is Admin. Full system access.');
              if (userData.assignedHiyawMahiderId && user?.uid) {
                this.loadMemberCount(userData.assignedHiyawMahiderId);
                this.loadAttendanceData(userData.assignedHiyawMahiderId, user.uid, userData.memberId);
              } else {
                this.memberCount = 0;
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            } else if (this.userRole === 'Pastor' || this.userRole === 'Deputy Pastor' || this.userRole === 'Zone Coordinator') {
              console.log(`User role is ${this.userRole}. Fetching data for assigned Hiyaw Mahider.`);
              if (userData.assignedHiyawMahiderId && user.uid) {
                this.loadMemberCount(userData.assignedHiyawMahiderId as string);
                this.loadAttendanceData(userData.assignedHiyawMahiderId as string, user.uid, userData.memberId);
              } else {
                console.warn(`${this.userRole} user has no assigned Hiyaw Mahider ID. Displaying general data.`);
                this.memberCount = 0;
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            } else if (this.userRole === 'Member') {
              console.log('User role is Member. Personal progress and fellowship access only.');
              this.memberCount = 0; // Members view their own assignments & progress
              if (userData.assignedHiyawMahiderId && user.uid) {
                this.loadAttendanceData(userData.assignedHiyawMahiderId as string, user.uid, userData.memberId);
              } else {
                this.initializeEmptyAttendanceData();
                this.calculateLearningProgressAndDaysActive([]);
              }
            } else {
              console.log('User role is Guest or default.');
              this.memberCount = 0;
              this.initializeEmptyAttendanceData();
              this.calculateLearningProgressAndDaysActive([]);
            }
            this.isLoading = false;
            this.cdr.detectChanges();
          } else {
            console.warn('User data not found for authenticated user.');
            this.resetUserDataAndPermissions();
            this.isLoading = false;
          }
        }).catch((error) => {
          console.error('Error fetching user data:', error);
          this.resetUserDataAndPermissions();
          this.isLoading = false;
        });
      } else {
        console.log('User is not authenticated (Guest).');
        this.resetUserDataAndPermissions();
        this.isLoading = false;
      }
    });
  }

  private resetUserDataAndPermissions(): void {
    this.userRole = 'Guest';
    this.userName = 'Guest';
    this.assignedHiyawMahider = '';
    this.initializeEmptyAttendanceData();
    this.calculateLearningProgressAndDaysActive([]);

    this.showAdminMenu = false;
    this.showReportsMenu = false;
    this.memberCount = 0;
    this.eventsConfig.showDescription = false;
    this.tasksConfig.showPriority = false;
    this.showAttendanceWidget = false; // Guests don't see attendance widget

    // Clear TasksService role/hiyawMahiderId for guests
    this.tasksService.setCurrentUserRole(null);
    this.tasksService.setCurrentUserHiyawMahiderId(null);
    this.cdr.detectChanges();
  }


  private loadAttendanceData(hiyawMahiderId: string, userId: string, memberId?: string): void {
    const searchId = memberId || userId;
    console.log('loadAttendanceData called for Hiyaw Mahider ID:', hiyawMahiderId, 'Access ID:', searchId);

    this.attendanceService.getAttendanceCountsByHiyawMahider(hiyawMahiderId, searchId).pipe(
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
    console.log('loadMemberCount (REST) called for Hiyaw Mahider ID:', hiyawMahiderId);

    // 🆕 OPTIMIZED: Fetch only 1 record to get the total count from metadata
    this.memberService.getMembersPaged({
      status: 'active',
      hiyawMahiderId: hiyawMahiderId,
      page: 1,
      pageSize: 1 // Fetch minimum data
    })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response) => {
          // Try to get total from typical pagination metadata locations
          // Adjust based on your actual API response structure for 'meta'
          const meta = response.meta;
          const total = meta?.pagination?.total ?? meta?.total ?? response.data?.length ?? 0;

          this.memberCount = total;
          console.log(`Member count (REST) received: ${this.memberCount} (fetched efficiently)`);
        },
        error: (error) => {
          console.error('Error fetching member count from REST API:', error);
          this.memberCount = 0;
        }
      });
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

    const isMobile = window.innerWidth < 768;

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
            position: isMobile ? 'bottom' : 'right',
            labels: {
              color: '#333',
              font: { size: 12 },
              padding: 15
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
          tooltip: { enabled: false }
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

      const uid = user.uid;
      if (!uid) {
        console.warn('User UID is undefined, skipping progress calculation');
        return;
      }

      // 🆕 CHANGED: Fetch full user data to get memberId
      this.authService.getUserData(uid).then(userData => {
        const currentUserId = uid;
        const memberId = userData?.memberId; // Backend UUID
        console.log('Calculating progress for:', { currentUserId, memberId });

        // Filter records from last 3 months where the current user (either ID) is listed
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

          // Check if date is within last 3 months AND user is in members list (matching either ID)
          return recordDate >= threeMonthsAgo &&
            record.members?.some(m => m['userId'] === currentUserId || (memberId && m['userId'] === memberId));
        });

        console.log('User records (last 3 months):', userRecords.length);

        let presentCount = 0;
        const totalOpportunities = userRecords.length;

        userRecords.forEach(record => {
          const userMember = record.members?.find(m => m['userId'] === currentUserId || (memberId && m['userId'] === memberId));
          if (userMember) {
            // Count as present if status is present, late, or new-guest
            const status = userMember['status'] || userMember['attendanceStatus'];
            if (status === 'present' || status === 'late' || status === 'new-guest') {
              presentCount++;
            }
          }
        });

        // Store counts for dialog
        this.presentCount = presentCount;
        this.totalOpportunities = totalOpportunities;

        // Store counts for dialog
        this.presentCount = presentCount;
        this.totalOpportunities = totalOpportunities;

        // Calculate progress percentage
        this.progressPercentage = totalOpportunities > 0
          ? parseFloat(((presentCount / totalOpportunities) * 100).toFixed(2))
          : 0;

        // Count unique active days
        const uniqueDates = new Set<string>();
        userRecords.forEach(record => {
          if (record['date']) {
            // Logic continues below...
            let d: Date;
            if (record['date'] instanceof Timestamp) d = record['date'].toDate();
            else if (record['date'] instanceof Date) d = record['date'];
            else d = new Date(record['date']);
            uniqueDates.add(d.toDateString());
          }
        });

        this.daysActive = uniqueDates.size;
        this.renderProgressChart();
        this.cdr.detectChanges();

      }); // End getUserData
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

  hasPermission(permission: string): boolean {
    return hasPermission(this.userRole, permission);
  }

  canModifyContent(): boolean {
    return ['Admin', 'Pastor', 'Deputy Pastor', 'Zone Coordinator'].includes(this.userRole);
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

  openAttendanceDetails(type: 'records' | 'progress' = 'records'): void {
    // Get current user ID and Member ID from cached user data if possible, or auth state
    this.authService.authState$.pipe(take(1)).subscribe((user: any) => {
      if (!user) return;
      const uid = user.uid;

      this.authService.getUserData(uid).then(userData => {
        this.dialog.open(AttendanceDetailsDialogComponent, {
          width: '600px',
          data: {
            rawRecords: this.rawAttendanceRecords || [],
            userId: uid,
            memberId: userData?.memberId,
            title: type === 'progress' ? 'Study Progress Details' : 'Attendance Record',
            type: type,
            progressStats: {
              percentage: this.progressPercentage,
              presentCount: this.presentCount,
              totalCount: this.totalOpportunities
            }
          }
        });
      });
    });
  }

  viewProgressDetails(): void {
    this.openAttendanceDetails('progress');
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
