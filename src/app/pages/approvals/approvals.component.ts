import { Component, OnInit } from '@angular/core';
import { ApprovalService } from '../../core/approval.service';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import { User } from '../../core/user.model';
import { firstValueFrom, take } from 'rxjs';

@Component({
  selector: 'app-approvals',
  templateUrl: './approvals.component.html',
  styleUrls: ['./approvals.component.css']
})
export class ApprovalsComponent implements OnInit {
  pendingApprovals: any[] = [];
  currentUser: User | null = null; // Initialize as null

  constructor(
    private approvalService: ApprovalService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const user = await firstValueFrom(this.authService.authState.pipe(take(1)));
      if (!user) {
        // Handle unauthenticated user
        return;
      }
      
      const userDoc = await firstValueFrom(this.userService.getUser(user.uid).pipe(take(1)));
      if (userDoc) {
        this.currentUser = userDoc;
        await this.loadPendingApprovals();
      }
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  async loadPendingApprovals(): Promise<void> {
    if (!this.currentUser) return;

    try {
      if (this.currentUser.role === 'admin') {
        this.pendingApprovals = await firstValueFrom(
          this.approvalService.getAllPendingApprovals().pipe(take(1))
        );
      } else if (this.currentUser.role === 'senior_pastor') {
        this.pendingApprovals = await firstValueFrom(
          this.approvalService.getPendingRoleChangeApprovals().pipe(take(1))
        );
      } else if (this.currentUser.role === 'zone_coordinator' && this.currentUser.zoneId) {
        this.pendingApprovals = await firstValueFrom(
          this.approvalService.getPendingApprovalsForZone(this.currentUser.zoneId).pipe(take(1))
        );
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    }
  }

  async approveRequest(requestId: string): Promise<void> {
    if (!this.currentUser) return;
    
    try {
      await this.approvalService.approveRequest(requestId, this.currentUser.uid);
      await this.loadPendingApprovals();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  }

  async rejectRequest(requestId: string): Promise<void> {
    if (!this.currentUser) return;
    
    try {
      await this.approvalService.rejectRequest(requestId, this.currentUser.uid);
      await this.loadPendingApprovals();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  }
}