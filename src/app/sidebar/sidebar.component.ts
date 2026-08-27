import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, Input, HostBinding, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { ReportService } from '../../app/core/services/report.service';
import { AuthService } from '../core/services/auth.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

interface Report {
  id: string;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
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
export class SidebarComponent implements OnInit {
  authService = inject(AuthService);
  reportService = inject(ReportService);

  @Input() isMobileMenuOpen: boolean = false;
  @Input() userName: string = '';
  @Output() navLinkClicked = new EventEmitter<void>();

  @HostBinding('class.side-nav') readonly hostClassSideNav = true; 
  @HostBinding('class.mobile-open') get mobileOpenClass() {
    return this.isMobileMenuOpen;
  }

  showReportsSubmenu = false;
  reports: Report[] = [];

  isAdminOrLeadership$: Observable<boolean> = combineLatest([
    this.authService.isAdmin$,
    this.authService.isPastor$,
    this.authService.isDeputyPastor$
  ]).pipe(
    map(([isAdmin, isPastor, isDeputyPastor]) => isAdmin || isPastor || isDeputyPastor)
  );

  isPastorOrDeputy$: Observable<boolean> = combineLatest([
    this.authService.isPastor$,
    this.authService.isDeputyPastor$
  ]).pipe(
    map(([isPastor, isDeputyPastor]) => isPastor || isDeputyPastor)
  );

  ngOnInit(): void {
    combineLatest([
      this.authService.isAdmin$,
      this.isPastorOrDeputy$
    ]).subscribe(([isAdmin, isPastorOrDeputy]) => {
      if (isAdmin) {
        this.reports = [
          { id: 'attendance', title: 'Attendance Report', icon: 'how_to_reg' },
          { id: 'hiyaw-mahider', title: 'Hiyaw Mahider Report', icon: 'diversity_3' },
          { id: 'follow-up', title: 'Follow-Up Report', icon: 'next_plan' },
        ];
      } else if (isPastorOrDeputy) {
        this.reports = [
          { id: 'attendance', title: 'Attendance Report', icon: 'how_to_reg' }
        ];
      } else {
        this.reports = [];
      }
    });
  }

  logout() {
    this.authService.logout();
    this.onNavLinkClick(); // Close menu on logout
  }

  toggleReports() {
    this.showReportsSubmenu = !this.showReportsSubmenu;
  }

  // Method to emit event when a nav link is clicked (to close menu on mobile)
  onNavLinkClick() {
    // Only emit if it's a mobile view
    if (window.innerWidth <= 768) {
      this.navLinkClicked.emit();
    }
  }
}
