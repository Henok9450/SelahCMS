// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './auth/login/login.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard]  // Changed from authGuard to AuthGuard
  },
  { path: 'login', component: LoginComponent },
  { 
    path: 'change-password', 
    loadComponent: () => import('./auth/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    canActivate: [AuthGuard]  // Changed here too
  },
  { path: '**', redirectTo: 'dashboard' }
];