import { Injectable } from '@angular/core';
import { 
  Auth, 
  authState, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword,
  browserSessionPersistence,
  setPersistence
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { firstValueFrom, Observable } from 'rxjs';

interface LoginResponse {
  mustChangePassword?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  authState$: Observable<any>; // Store the authState observable

  constructor(
    private auth: Auth,
    private router: Router,
    private userService: UserService
  ) {
    // Ensure persistence is set within Angular's context
    setPersistence(this.auth, browserSessionPersistence).catch((error) => {
      console.error('Error setting persistence:', error);
    });

    // Initialize authState observable
    this.authState$ = authState(this.auth);
  }

  get authState() {
    return this.authState$; // Return the stored observable
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (!result.user) throw new Error('Authentication failed');

      const userDoc = await firstValueFrom(this.userService.getUser(result.user.uid));
      
      if (userDoc?.mustChangePassword) {
        this.router.navigate(['/change-password']);
        return { mustChangePassword: true };
      }
      
      return {};
    } catch (error: any) {
      throw this.translateFirebaseError(error);
    }
  }

  async getUserRole(uid: string): Promise<string | undefined> {
    try {
      const userDoc = await firstValueFrom(this.userService.getUser(uid));
      return userDoc?.role; // Assuming the role is stored in the 'role' field
    } catch (error) {
      console.error('Error fetching user role:', error);
      throw new Error('Failed to fetch user role');
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    
    if (!user || !user.email) {
      this.router.navigate(['/login']);
      throw new Error('Authentication required');
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      await this.userService.updateUser(user.uid, { mustChangePassword: false });
    } catch (error: any) {
      throw this.translateFirebaseError(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      throw this.translateFirebaseError(error);
    }
  }

  private translateFirebaseError(error: any): Error {
    const messages: Record<string, string> = {
      'auth/wrong-password': 'Incorrect password',
      'auth/user-not-found': 'User not found',
      'auth/too-many-requests': 'Account temporarily locked',
    };
    
    return new Error(messages[error.code] || error.message || 'Authentication failed');
  }
} 