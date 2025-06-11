import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
//import { AuthService } from './core/auth.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { filter } from 'rxjs/operators';
import { CoreModule } from './core/core.module';
import { HomeComponent } from "./home/home.component";
import { SidebarComponent } from "./sidebar/sidebar.component";

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
    MatIconModule,
    MatMenuModule,
    HomeComponent,
    SidebarComponent
],
  
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent implements OnInit {
  currentYear = new Date().getFullYear();
  showFooter = true;
  private router = inject(Router);
  // authService = inject(AuthService);
  
  userName: string = 'Henok Birhanu';
  userRole: string = 'Admin';


  ngOnInit() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.showFooter = !event.url.includes('/login');
      });
  }

  logout() {
    // this.authService.logout()
    //   .then(() => this.router.navigate(['/login']))
    //   .catch(error => console.error('Logout error:', error));
  }

  viewProfile() {
    this.router.navigate(['/profile']);
  }

  changePassword() {
    this.router.navigate(['/change-password']);
  }
}