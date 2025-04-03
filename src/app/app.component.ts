import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { AuthService } from './core/auth.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { filter } from 'rxjs/operators';
import { AdminComponent } from './pages/admin/admin.component';
import { ApprovalsComponent } from './pages/approvals/approvals.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

import { EventsComponent } from './pages/events/events.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { UserManagementComponent } from './pages/user-management/user-management.component';
import { TasksComponent } from './pages/tasks/tasks.component';
import { StudyMaterialsComponent } from './pages/study-materials/study-materials.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    AdminComponent,
    ApprovalsComponent,
    DashboardComponent,
    EventsComponent,
    ProfileComponent,
    ReportsComponent,
    UserManagementComponent,
    StudyMaterialsComponent,
    TasksComponent,
    MatMenuModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Hiyaw Mahider Learning System</span>
      
      <span class="spacer"></span>

      <div *ngIf="authService.authState | async as user; else loginButton">
        <button mat-button [matMenuTriggerFor]="userMenu">
          <mat-icon>account_circle</mat-icon>
          {{ user.displayName || user.email }}
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item routerLink="/profile">
            <mat-icon>account_circle</mat-icon>
            Profile
          </button>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            Logout
          </button>
        </mat-menu>
      </div>

      <ng-template #loginButton>
        <button mat-button routerLink="/login">
          <mat-icon>login</mat-icon>
          Login
        </button>
      </ng-template>
    </mat-toolbar>

    <main class="content">
      <router-outlet></router-outlet>
    </main>

    <footer *ngIf="showFooter" class="footer">
      <p>© {{currentYear}} Hiyaw Mahider Learning System</p>
    </footer>
  `,
  styles: [`
    .spacer {
      flex: 1 1 auto;
    }
    .content {
      padding: 20px;
      min-height: calc(100vh - 128px);
    }
    .footer {
      padding: 10px;
      text-align: center;
      background-color: #f5f5f5;
    }
  `]
})
export class AppComponent implements OnInit {
  currentYear = new Date().getFullYear();
  showFooter = true;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Hide footer on login page
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.showFooter = !event.url.includes('/login');
      });
  }

  logout() {
    this.authService.logout()
      .then(() => this.router.navigate(['/login']))
      .catch(error => console.error('Logout error:', error));
  }
}