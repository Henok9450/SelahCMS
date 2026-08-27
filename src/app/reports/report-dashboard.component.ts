import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card'; // Import MatCardModule
import { MatIconModule } from '@angular/material/icon'; // Import MatIconModule
import { RouterModule } from '@angular/router';
import { ReportService } from '../core/services/report.service';

@Component({
  selector: 'app-report-dashboard',
  standalone: true,
  imports: [
    MatCardModule, // Add MatCardModule here
    MatIconModule, // Add MatIconModule here
    RouterModule
  ],
  template: `
    <div class="report-grid">
      <mat-card *ngFor="let report of availableReports" 
                [routerLink]="['/reports', report.id]"
                class="report-card">
        <mat-icon>{{report.icon}}</mat-icon>
        <h3>{{report.title}}</h3>
        <p>{{report.description}}</p>
      </mat-card>
    </div>
  `,
  //styleUrls: ['./report-dashboard.component.css']
})
export class ReportDashboardComponent {
  availableReports: any[] = []; // Initialize as an empty array

  constructor(private reportService: ReportService) { } 

  ngOnInit() {
    this.availableReports = this.reportService.getAvailableReports(); // Initialize reports here
  }
}
