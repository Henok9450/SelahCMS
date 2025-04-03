import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { EventService } from '../../core/event.service';
import { TaskService } from '../../core/task.service';
import { User } from '../../core/user.model';
import { firstValueFrom, take } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  hiyawMahider: any = null;
  upcomingEvents: any[] = [];
  pendingTasks: any[] = [];
  members: User[] = [];
  isLoading = true;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    private eventService: EventService,
    private taskService: TaskService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const authUser = await firstValueFrom(this.authService.authState.pipe(take(1)));
      if (!authUser) {
        this.isLoading = false;
        return;
      }

      const userDoc = await firstValueFrom(this.userService.getUser(authUser.uid).pipe(take(1)));
      if (!userDoc) {
        this.isLoading = false;
        return;
      }

      this.currentUser = userDoc;
      
      // Load group-related data only if hiyawMahiderId exists
      if (this.currentUser.hiyawMahiderId) {
        this.hiyawMahider = await firstValueFrom(
          this.hiyawMahiderService.getHiyawMahider(this.currentUser.hiyawMahiderId).pipe(take(1))
        );
        
        this.members = await firstValueFrom(
          this.userService.getUsersByHiyawMahider(this.currentUser.hiyawMahiderId).pipe(take(1))
        );

        // Only load events if we have a hiyawMahiderId
        this.upcomingEvents = await firstValueFrom(
          this.eventService.getEventsForGroup(this.currentUser.hiyawMahiderId).pipe(take(1))
        );
      }

      // Always load user tasks (don't need hiyawMahiderId)
      this.pendingTasks = await firstValueFrom(
        this.taskService.getUserTasks(authUser.uid, 'pending').pipe(take(1))
      );
    } catch (error) {
      console.error('Dashboard initialization error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}