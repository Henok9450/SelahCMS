import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ROLES } from './core/role.utils';
import { RoleGuard } from './core/role.guard';
import { noAuthGuard } from './core//auth.guard';


// Import the report components
import { UserManagementReportComponent } from './reports/user-management-report/user-management-report.component';
import { AttendanceReportComponent } from './reports//attendance-report/attendance-report.component';
import { HiyawMahiderReportComponent } from './reports//hiyaw-mahider-report/hiyaw-mahider-report.component';
import { FollowUpReportComponent } from './reports/follow-up-report/follow-up-report.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'home', 
    pathMatch: 'full' 
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
    title: 'Home',
    canActivate: [authGuard]
  },

  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [noAuthGuard] // Important - allow access without auth
  },
  {
    path: 'pages',
    canActivate: [authGuard], // Protect entire pages section
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
        title: 'Dashboard'
      },

      // *** EVENTS ROUTES - CRITICAL FOR DETAIL/CREATE VIEWS ***
      {
        path: 'events', // Base route for events list
        loadComponent: () =>
          import('./pages/events/events.component').then(m => m.EventsComponent),
        title: 'Events'
      },
      {
        path: 'events/new', // Route for adding a new event (e.g., /pages/events/new)
        loadComponent: () =>
          import('./pages/events/events.component').then(m => m.EventsComponent),
        title: 'Create Event',
        data: { mode: 'create' } // Pass mode to component
      },
      {
        path: 'events/:id', // Route for viewing/editing a specific event (e.g., /pages/events/123)
        loadComponent: () =>
          import('./pages/events/events.component').then(m => m.EventsComponent),
        title: 'Event Details',
        data: { mode: 'view' } // Pass mode to component
      },
      // *** END EVENTS ROUTES ***

      // *** TASKS ROUTES - CRITICAL FOR DETAIL/CREATE VIEWS ***
      {
        path: 'tasks', // Base route for tasks list
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
        title: 'Tasks'
      },
      {
        path: 'tasks/new', // Route for adding a new task
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
        title: 'Create Task',
        data: { mode: 'create' }
      },
      {
        path: 'tasks/:id', // Route for viewing/editing a specific task
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
        title: 'Task Details',
        data: { mode: 'view' }
      },
      // *** END TASKS ROUTES ***

      // Other existing routes 
      {
        path: 'user-management',
        loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent),
        title: 'User Management',
        data: { roles: ['Admin'] } // Role restriction
      },
      {
        path: 'hiyaw-mahider',
        loadComponent: () =>
          import('./pages/hiyaw-mahider/hiyaw-mahider.component').then(m => m.HiyawMahiderComponent),
        title: 'Hiyaw Mahider'
      },
      {
        path: 'pastors',
        loadComponent: () =>
          import('./pages/pastors/pastor.component').then(m => m.PastorComponent),
        title: 'Pastors'
      },
      {
        path: 'zone',
        loadComponent: () =>
          import('./pages/zone/zone.component').then(m => m.ZoneComponent),
        title: 'Zones'
      },
      {
        path: 'members-list',
        loadComponent: () =>
          import('./pages/members-list/members-list.component').then(m => m.MembersListComponent),
        title: 'Members'
      },
      {
        path: 'study-materials',
        loadComponent: () =>
          import('./pages/study-materials/study-materials.component').then(m => m.StudyMaterialsComponent),
        title: 'Study Materials'
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./attendance/attendance.component').then(m => m.AttendanceComponent),
        title: 'Attendance'
      }
    ]
  },
  // New reports route
  // Updated reports route section
{
  path: 'reports',
  canActivate: [authGuard], // Add auth protection
  children: [
    { 
      path: 'user-management', 
      loadComponent: () => import('./reports/user-management-report/user-management-report.component').then(m => m.UserManagementReportComponent),
      title: 'User Management Report'
    },
    { 
      path: 'attendance', 
      loadComponent: () => import('./reports/attendance-report/attendance-report.component').then(m => m.AttendanceReportComponent),
      title: 'Attendance Report' 
    },
    { 
      path: 'hiyaw-mahider', 
      loadComponent: () => import('./reports/hiyaw-mahider-report/hiyaw-mahider-report.component').then(m => m.HiyawMahiderReportComponent),
      title: 'Hiyaw Mahider Report' 
    },
    { 
      path: 'follow-up', 
      loadComponent: () => import('./reports/follow-up-report/follow-up-report.component').then(m => m.FollowUpReportComponent),
      title: 'Follow Up Report' 
    },
    { path: '', redirectTo: 'user-management', pathMatch: 'full' }
  ]
},
  { 
    path: 'unauthorized',
    loadComponent: () => import('../../src/app/shared/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  { 
    path: '**', 
    redirectTo: 'home' 
  }   
];