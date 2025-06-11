import { Routes } from '@angular/router';
//import { authGuard } from './core/auth.guard';

// Import the new report components
import { UserManagementReportComponent } from './reports/user-management-report/user-management-report.component'; // **Update this path**
import { AttendanceReportComponent } from './reports//attendance-report/attendance-report.component'; // **Update this path**
import { HiyawMahiderReportComponent } from './reports//hiyaw-mahider-report/hiyaw-mahider-report.component'; // **Update this path**
import { ZoneReportComponent } from './reports/zone-report/zone-report.component'; // **Update this path**


export const routes: Routes = [
  // Default route redirects to 'home'
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Home Page (Public)
  {
    path: 'home1',
    loadComponent: () =>
      import('./app.component').then(m => m.AppComponent),
    title: 'Home'
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.component').then(m => m.HomeComponent),
    title: 'Home'
  },

  // Login Page (Public)
  // {
  //   path: 'login',
  //   loadComponent: () =>
  //     import('./auth/login/login.component').then(m => m.LoginComponent),
  //   title: 'Login'
  // },

  // Protected routes under 'pages' namespace (optional grouping)
  {
    path: 'pages',
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then(m => m.TasksComponent),

        title: 'Dashboard'
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then(m => m.TasksComponent),

        title: 'Tasks'
      },
      {
        path: 'user-management',
        loadComponent: () =>
          import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent),

        title: 'User Management'
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
        path: 'events',
        loadComponent: () =>
          import('./pages/events/events.component').then(m => m.EventsComponent),

        title: 'Events'
      },


      {
        path: 'zone',
        loadComponent: () =>
          import('./pages/zone/zone.component').then(m => m.ZoneComponent),

        title: 'Zones'
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
  {
    path: 'reports',
    children: [
      { path: 'user-management', component: UserManagementReportComponent },
      { path: 'attendance', component: AttendanceReportComponent },
      { path: 'hiyaw-mahider', component: HiyawMahiderReportComponent },
      { path: 'zone', component: ZoneReportComponent },
      { path: '', redirectTo: 'user-management', pathMatch: 'full' }
    ]
  }

  // Fallback route redirects to 'home'
  // { path: '**', redirectTo: 'home' }
];