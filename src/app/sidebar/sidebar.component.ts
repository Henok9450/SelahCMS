// sidebar.component.ts
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { ReportService } from '../../app/core/report.service';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatListModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})export class SidebarComponent {
  reports: any[] = []; // Initialize as an empty array
  showReportsSubmenu: boolean = false; // Add this property

  constructor(private reportService: ReportService) {}

  ngOnInit() {
    this.reports = this.reportService.getAvailableReports(); // Initialize reports here
  }

  toggleReports() {
    this.showReportsSubmenu = !this.showReportsSubmenu; // Toggle the submenu visibility
  }
}