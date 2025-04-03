// src/app/user-management/user-management.component.ts
import { Component, OnInit } from '@angular/core';
import { UserService } from '../../core/user.service';
import { HiyawMahiderService } from '../../core/hiyaw-mahider.service';
import { ZoneService } from '../../core/zone.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../core/user.model';
import { MatDialog } from '@angular/material/dialog';
import { UserFormDialogComponent } from '../../../app/user-management/user-form-dialog/user-form-dialog.component';
import { firstValueFrom, take } from 'rxjs';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  currentUser: User | null = null;
  hiyawMahiders: any[] = [];
  zones: any[] = [];
  isLoading = false;

  constructor(
    private userService: UserService,
    private hiyawMahiderService: HiyawMahiderService,
    private zoneService: ZoneService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    try {
      const authUser = await firstValueFrom(this.authService.authState.pipe(take(1)));
      if (!authUser) {
        this.isLoading = false;
        return;
      }

      const userDoc = await firstValueFrom(this.userService.getUser(authUser.uid).pipe(take(1)));
      if (userDoc) {
        this.currentUser = userDoc;
        await this.loadUsers();
        
        if (this.currentUser.role === 'zone_coordinator' || this.currentUser.role === 'admin') {
          this.zones = await firstValueFrom(this.zoneService.getZones().pipe(take(1)));
        }
        
        if (this.currentUser.role === 'pastor' || this.currentUser.role === 'deputy_pastor' || 
            this.currentUser.role === 'zone_coordinator' || this.currentUser.role === 'admin') {
          this.hiyawMahiders = await firstValueFrom(this.hiyawMahiderService.getHiyawMahiders().pipe(take(1)));
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadUsers(): Promise<void> {
    if (!this.currentUser) return;
    this.isLoading = true;

    try {
      if (this.currentUser.role === 'admin' || this.currentUser.role === 'senior_pastor') {
        this.users = await firstValueFrom(this.userService.getUsers().pipe(take(1)));
      } else if (this.currentUser.role === 'zone_coordinator' && this.currentUser.zoneId) {
        this.users = await firstValueFrom(this.userService.getUsersByZone(this.currentUser.zoneId).pipe(take(1)));
      } else if ((this.currentUser.role === 'pastor' || this.currentUser.role === 'deputy_pastor') && this.currentUser.hiyawMahiderId) {
        this.users = await firstValueFrom(this.userService.getUsersByHiyawMahider(this.currentUser.hiyawMahiderId).pipe(take(1)));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openUserForm(user?: User): void {
    if (!this.currentUser) return;

    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '600px',
      data: { 
        user: user || null,
        currentUserRole: this.currentUser.role,
        hiyawMahiders: this.hiyawMahiders,
        zones: this.zones
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  async deleteUser(userId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await this.userService.deleteUser(userId);
      await this.loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }
}