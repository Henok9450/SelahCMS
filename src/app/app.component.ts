// app.component.ts
import { Component, OnInit, OnDestroy, inject, HostListener, NgZone } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';
import { CoreModule } from './core/core.module';
import { SidebarComponent } from "./sidebar/sidebar.component";
import { SessionTimeoutDialogComponent } from './shared/session-timeout-dialog/session-timeout-dialog.component';

import { Observable } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../environments/environment';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    CoreModule,
    AsyncPipe,
    DatePipe,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatInputModule,
    MatDividerModule,
    MatTooltipModule,
    SidebarComponent,
    SessionTimeoutDialogComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  showFooter = true;
  showHeaderAndSidebar = true;
  userName: string = 'User';
  user$!: Observable<any>;
  appVersion = environment.appVersion;

  // Live clock
  now: Date = new Date();
  private clockInterval: any;

  // Mobile menu state
  isMobileMenuOpen: boolean = false;

  private router = inject(Router);
  private ngZone = inject(NgZone);
  authService = inject(AuthService);

  showSessionWarning$ = this.authService.showSessionWarning$;

  ngOnInit(): void {
    this.user$ = this.authService.authState$;

    // Start live clock
    this.clockInterval = setInterval(() => {
      this.now = new Date();
    }, 1000);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        const isLoginPage = event.url.includes('/login') || event.url.includes('/forgot-password');
        this.showFooter = !isLoginPage;
        this.showHeaderAndSidebar = !isLoginPage;

        if (this.isMobileMenuOpen) {
          this.closeMobileMenu();
        }
      });

    this.user$.subscribe(user => {
      if (!user) {
        this.userName = 'User';
        const currentUrl = this.router.url;
        if (!currentUrl.includes('/login') && !currentUrl.includes('/forgot-password')) {
          this.ngZone.run(() => {
            this.router.navigate(['/login']);
          });
        }
        return;
      }

      this.userName = user?.displayName || user?.fullName || user?.full_name || user?.email || 'User';
      if (user && (user.uid || user.firebase_uid)) {
        const uid = user.uid || user.firebase_uid;
        this.authService.getUserData(uid).then(userData => {
          if (userData && userData.displayName) {
            this.userName = userData.displayName;
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  getUserInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  logout() {
    this.authService.logout()
      .then(() => this.router.navigate(['/login']))
      .catch(error => console.error('Logout error:', error));
  }

  viewProfile() {
    this.router.navigate(['/profile']);
  }

  changePassword() {
    this.router.navigate(['/change-password']);
  }

  // --- Mobile Menu Methods ---
  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.toggleBodyScroll();
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.toggleBodyScroll();
  }

  private toggleBodyScroll() {
    if (this.isMobileMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
  }

  // Close menu on resize if it's open and screen goes large
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    // 768px is your breakpoint for mobile/desktop layout
    if (window.innerWidth > 768 && this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }
}
