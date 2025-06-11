import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
///import { AuthService } from '../../../src/app/core/auth.service';
import { Router } from '@angular/router';
import { EventsService } from '../../../src/app/core/events.service';
import { TasksService } from '../../app/core/tasks.service';
import { MatDialog } from '@angular/material/dialog';
import { EventsComponent } from '../../app/pages/events/events.component';
import { TasksComponent } from '../../app/pages/tasks/tasks.component';
import { Task } from '../../app/core/tasks.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

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
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('progressChart') progressChartRef!: ElementRef;
  
  // Widget visibility
  showEventsWidget: boolean = true;
  showTasksWidget: boolean = true;

  // User info
  userName: string = 'Henok Birhanu';
  userRole: string = 'Admin';
  
  // Quick stats
  memberCount: number = 24;
  pendingApprovals: number = 3;
  upcomingEvents: number = 2;
  completedCourses: number = 5;
  
  // Recent events
  recentEvents: any[] = [];
  
  // Recent tasks
  recentTasks: any[] = [];
  
  // Learning progress
  progressPercentage: number = 75;
  currentCourse: string = 'Gospel of John';
  daysActive: number = 42;
  
  // Announcements
  recentAnnouncements = [
    { 
      title: 'System Maintenance', 
      date: new Date('2023-06-10'), 
      content: 'The system will be down for maintenance on June 12th from 2:00 AM to 4:00 AM.', 
      important: true, 
      author: 'Admin Team' 
    },
    { 
      title: 'New Study Materials', 
      date: new Date('2023-06-08'), 
      content: 'New study materials for the Book of Acts have been uploaded to the system.', 
      important: false, 
      author: 'Content Team' 
    }
  ];
  
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
  showPendingApprovals: boolean = true;
  showProgressWidget: boolean = true;
  showAnnouncementsWidget: boolean = true;

  // Events configuration
  eventsConfig = {
    showWidget: true,
    maxItems: 3,
    showLocation: true,
    showDate: true,
    showDescription: false,
    customFields: [] as {name: string, visible: boolean}[]
  };

  // Tasks configuration
  tasksConfig = {
    showWidget: true,
    maxItems: 3,
    showDueDate: true,
    showStatus: true,
    showPriority: false,
    customFields: [] as {name: string, visible: boolean}[]
  };

  constructor(
    //private authService: AuthService,
    private router: Router,
    private eventsService: EventsService,
    private tasksService: TasksService,
    private dialog: MatDialog
  ) {
    Chart.register(...registerables);
    this.loadMaterialIcons();
  }
  
  ngOnInit(): void {
    //this.setRoleBasedPermissions();
    //this.loadEvents();
    this.loadTasks();
    //this.loadCustomConfigurations();
  }

  ngAfterViewInit(): void {
    this.renderProgressChart();
  }
  
  private loadMaterialIcons(): void {
    // Check if the Material Icons stylesheet is already loaded
    if (!document.querySelector('link[href="https://fonts.googleapis.com/icon?family=Material+Icons"]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }
  
  // private setRoleBasedPermissions(): void {
  //   this.authService.authState.subscribe((user) => {
  //     if (user) {
  //       this.authService.getUserRole(user.uid).then((role) => {
  //         // Example role-based configurations
  //         if (role === 'Member') {
  //           this.showAdminMenu = false;
  //           this.showReportsMenu = false;
  //           this.showPendingApprovals = false;
  //           this.eventsConfig.showDescription = false;
  //           this.tasksConfig.showPriority = false;
  //         }
  
  //         if (role === 'Pastor' || role === 'Deputy Pastor') {
  //           this.showAdminMenu = false;
  //           this.eventsConfig.showDescription = true;
  //         }
  
  //         if (role === 'Zone Coordinator') {
  //           this.showAdminMenu = false;
  //           this.eventsConfig.maxItems = 5;
  //           this.tasksConfig.maxItems = 5;
  //         }
  
  //         if (role === 'Senior Pastor') {
  //           this.showAdminMenu = false;
  //           this.eventsConfig.maxItems = 5;
  //           this.tasksConfig.maxItems = 5;
  //         }
  //       }).catch((error) => {
  //         console.error('Error fetching user role:', error);
  //       });
  //     } else {
  //       console.warn('No user is logged in.');
  //     }
  //   });
  // }
  
  // private loadCustomConfigurations(): void {
  //   const savedEventsConfig = localStorage.getItem('eventsWidgetConfig');
  //   const savedTasksConfig = localStorage.getItem('tasksWidgetConfig');
    
  //   if (savedEventsConfig) {
  //     this.eventsConfig = { ...this.eventsConfig, ...JSON.parse(savedEventsConfig) };
  //   }
    
  //   if (savedTasksConfig) {
  //     this.tasksConfig = { ...this.tasksConfig, ...JSON.parse(savedTasksConfig) };
  //   }
  // }

  // private loadEvents(): void {
  //   this.eventsService.getUpcomingEvents(this.eventsConfig.maxItems).subscribe(
  //     events => {
  //       this.recentEvents = events;
  //       this.upcomingEvents = events.length;
  //     },
  //     error => console.error('Error loading events', error)
  //   );
  // }

  private loadTasks(): void {
    this.tasksService.getLimitedTasks(this.tasksConfig.maxItems).subscribe(
      (tasks: Task[]) => {
        this.recentTasks = tasks;
      },
      (error: any) => console.error('Error loading tasks', error)
    );
  }

  // updateEventsConfig(newConfig: any): void {
  //   this.eventsConfig = { ...this.eventsConfig, ...newConfig };
  //   localStorage.setItem('eventsWidgetConfig', JSON.stringify(this.eventsConfig));
  //   this.loadEvents();
  // }

  updateTasksConfig(newConfig: any): void {
    this.tasksConfig = { ...this.tasksConfig, ...newConfig };
    localStorage.setItem('tasksWidgetConfig', JSON.stringify(this.tasksConfig));
    this.loadTasks();
  }
  
  private renderProgressChart(): void {
    if (!this.progressChartRef || !this.progressChartRef.nativeElement) {
      console.error('Progress chart element is not available.');
      return;
    }
  
    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Remaining'],
        datasets: [
          {
            data: [this.progressPercentage, 100 - this.progressPercentage],
            backgroundColor: ['#4CAF50', '#E0E0E0'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }    
  
  // openEvents(): void {
  //   const dialogRef = this.dialog.open(EventsComponent, {
  //     width: '500px',
  //     data: { config: {...this.eventsConfig} }
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.updateEventsConfig(result);
  //     }
  //   });
  // }

  openTasks(): void {
    const dialogRef = this.dialog.open(TasksComponent, {
      width: '500px',
      data: { config: {...this.tasksConfig} }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateTasksConfig(result);
      }
    });
  }
  
  viewProfile(): void {
    this.router.navigate(['/profile']);
  }
  
  changePassword(): void {
    this.router.navigate(['/change-password']);
  }
  
  logout(): void {
    //this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  viewAllEvents(): void {
    this.router.navigate(['/events']);
  }
  
  viewAllTasks(): void {
    this.router.navigate(['../pages/tasks']);
  }
  
  viewProgressDetails(): void {
    this.router.navigate(['/progress']);
  }
  
  viewAllAnnouncements(): void {
    this.router.navigate(['/announcements']);
  }

}