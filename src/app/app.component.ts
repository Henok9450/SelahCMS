// app.component.ts
import { Component, OnInit, inject, HostListener } from '@angular/core'; // Added HostListener
import { CommonModule, AsyncPipe } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthService } from './core/auth.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { filter } from 'rxjs/operators';
import { CoreModule } from './core/core.module';
import { HomeComponent } from "./home/home.component";
import { SidebarComponent } from "./sidebar/sidebar.component";
import { HasRoleDirective } from '../../src/app/directives/has-role.directive';
import { Observable } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field'; 
import { MatInputModule } from '@angular/material/input'; 
import { environment } from '../environments/environment';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    CoreModule,
    AsyncPipe,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatInputModule,
    HasRoleDirective,
    HomeComponent,
    SidebarComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  currentYear = new Date().getFullYear();
  showFooter = true;
  showHeaderAndSidebar = true;
  userName: string = 'User';
  user$!: Observable<any>;
  appVersion = environment.appVersion;

  // New property for mobile menu state
  isMobileMenuOpen: boolean = false; // Initialize as closed

  private router = inject(Router);
  authService = inject(AuthService);

  ngOnInit(): void {
    this.user$ = this.authService.authState$;

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        const isLoginPage = event.url.includes('/login');
        this.showFooter = !isLoginPage;
        this.showHeaderAndSidebar = !isLoginPage;
        
        // Ensure menu is closed when navigating to a new page (especially login)
        if (this.isMobileMenuOpen) {
          this.closeMobileMenu();
        }
      });

    this.user$.subscribe(user => {
      this.userName = user?.fullName || user?.displayName || user?.email || 'User';
    });
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