// auth.service.ts
import { Injectable, NgZone } from '@angular/core'; // Import NgZone
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { firstValueFrom, Observable, of, BehaviorSubject, fromEvent, merge, Subscription } from 'rxjs'; // Add merge, fromEvent, Subscription
import { User } from './user.model';
import { switchMap, map, catchError, tap, first, debounceTime } from 'rxjs/operators'; // Add debounceTime
import { AppRole, ROLES } from './role.utils';
import { doc, getDoc, Firestore, docData } from '@angular/fire/firestore';
import { HiyawMahiderService } from './hiyaw-mahider.service';
import 'firebase/compat/auth';
import { initializeAuth, browserSessionPersistence } from '@angular/fire/auth';
import { getApp } from '@angular/fire/app';
import { initializeApp, deleteApp, FirebaseApp } from '@angular/fire/app';
import { inMemoryPersistence } from '@angular/fire/auth';

interface LoginResponse {
  mustChangePassword?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _authState$: Observable<User | null>;
  isAdmin$: Observable<boolean>;
  isPastor$: Observable<boolean>;
  isDeputyPastor$: Observable<boolean>;

  // Session Timeout Properties
  private sessionTimeoutInMinutes = 15; // Set your desired timeout duration in minutes
  private activityMonitorSubscription: Subscription | null = null;
  private timeoutId: any;

  constructor(
    private auth: Auth,  
    private router: Router,
    private userService: UserService,
    private firestore: Firestore,
    private hiyawMahiderService: HiyawMahiderService,
    private ngZone: NgZone // Inject NgZone
  ) {
    console.log('AuthService: Constructor called.');

    this._authState$ = authState(this.auth).pipe(
      tap(firebaseUser => {
        console.log('AuthService: authState(this.auth) emitted Firebase user:', firebaseUser ? firebaseUser.uid : null);
        if (firebaseUser && firebaseUser.email) {
          console.log('AuthService: Firebase User Email:', firebaseUser.email);
          this.startSessionTimer(); // Start timer when a user is logged in
        } else {
          this.stopSessionTimer(); // Stop timer when no user is logged in
        }
      }),
      switchMap(firebaseUser => {
        if (firebaseUser) {
          console.log(`AuthService: Firebase user found (${firebaseUser.uid}). Fetching user data from Firestore via UserService.`);
          return this.userService.getUser(firebaseUser.uid).pipe(
            tap(firestoreUser => {
              console.log('AuthService: UserService.getUser emitted Firestore user data:', firestoreUser);
              if (!firestoreUser) {
                console.warn(`AuthService: No Firestore user document found for UID: ${firebaseUser.uid}. This user might be newly registered or missing profile data.`);
              }
            }),
            map(firestoreUser => {
              const mergedUser: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName: firestoreUser?.fullName || firebaseUser.displayName || 'User',
                phoneNumber: firestoreUser?.phoneNumber || '',
                residencyLocation: firestoreUser?.residencyLocation || '',
                maritalStatus: firestoreUser?.maritalStatus || 'Single',
                role: firestoreUser?.role || 'Member',
                assignedHiyawMahider: firestoreUser?.assignedHiyawMahider || null,
                pastor: firestoreUser?.pastor || '',
                deputyPastor: firestoreUser?.deputyPastor || '',
                active: firestoreUser?.active ?? true,
                firstLogin: firestoreUser?.firstLogin ?? false,
                displayName: firebaseUser.displayName || 'User',
                emailVerified: firebaseUser.emailVerified,
                createdAt: firestoreUser?.createdAt || new Date(),
                updatedAt: new Date()
              };
              console.log('AuthService: Merged user object:', mergedUser);
              return mergedUser;
            }),
            catchError(error => {
              console.error(`AuthService: Error fetching user data for UID ${firebaseUser.uid}:`, error);
              const defaultUser: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName: firebaseUser.displayName || 'User',
                phoneNumber: '',
                residencyLocation: '',
                maritalStatus: 'Single',
                role: 'Member',
                assignedHiyawMahider: null,
                pastor: '',
                deputyPastor: '',
                active: true,
                firstLogin: false,
                displayName: firebaseUser.displayName || 'User',
                emailVerified: firebaseUser.emailVerified,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              console.log('AuthService: Emitting default user due to Firestore fetch error:', defaultUser);
              return of(defaultUser);
            })
          );
        }
        console.log('AuthService: No Firebase user detected. Emitting null.');
        return of(null);
      })
    );

    this.isAdmin$ = this.hasRole(ROLES.ADMIN);
    this.isPastor$ = this.hasRole(ROLES.PASTOR);
    this.isDeputyPastor$ = this.hasRole(ROLES.DEPUTY_PASTOR);
  }

  get authState$() {
    return this._authState$;
  }

  get currentUserRole(): Observable<AppRole | null> {
    return this.authState$.pipe(
      map(user => user?.role || null)
    );
  }

  hasRole(role: AppRole): Observable<boolean> {
    return this.authState$.pipe(
      map(user => user?.role === role)
    );
  }

  hasAnyRole(roles: AppRole[]): Observable<boolean> {
    return this.authState$.pipe(
      map(user => user ? roles.includes(user.role) : false)
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      console.log('AuthService: Attempting login for:', email);
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('AuthService: Login successful. User:', result.user.uid);

      if (!result.user) {
        throw new Error('Authentication failed: No user object returned.');
      }

      const userDoc = await firstValueFrom(this.userService.getUser(result.user.uid));
      console.log('AuthService: Fetched user doc after login:', userDoc);

      if (userDoc?.firstLogin) {
        console.log('AuthService: User is first login, redirecting to change-password.');
        this.router.navigate(['/change-password']);
        return { mustChangePassword: true };
      }

      this.startSessionTimer(); // Start timer on successful login
      return {};
    } catch (error: any) {
      console.error('AuthService: Login error:', error);
      throw this.translateFirebaseError(error);
    }
  }

// auth.service.ts
async register(registrationData: {
  email: string;
  fullName: string;
  phoneNumber?: string;
  residencyLocation?: string;
  maritalStatus?: string;
  role?: string;
  assignedHiyawMahider?: string;
  pastor?: string;
  deputyPastor?: string;
  active?: boolean;
}): Promise<void> {
  try {
    console.log('AuthService: Attempting registration for:', registrationData.email);

    // Temporarily disable session timer
    this.stopSessionTimer();

    // Store current admin UID
    const adminUid = this.auth.currentUser?.uid;

    // Validate inputs
    const validMaritalStatuses: Array<"Single" | "Married"> = ["Single", "Married"];
    const maritalStatus = validMaritalStatuses.includes(registrationData.maritalStatus as "Single" | "Married")
      ? (registrationData.maritalStatus as "Single" | "Married")
      : "Single";

    const validRoles: Array<"Member" | "Admin" | "Pastor" | "Deputy Pastor"> = 
      ["Member", "Admin", "Pastor", "Deputy Pastor"];
    const role = validRoles.includes(registrationData.role as "Member" | "Admin" | "Pastor" | "Deputy Pastor")
      ? (registrationData.role as "Member" | "Admin" | "Pastor" | "Deputy Pastor")
      : "Member";

    const tempPassword = this.generateRandomPassword();

    // Create new user
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      registrationData.email,
      tempPassword
    );
    
    const firebaseUser = userCredential.user;
    console.log('AuthService: Firebase user created:', firebaseUser?.uid);

    if (!firebaseUser) {
      throw new Error('Firebase user creation failed: No user object returned.');
    }

    // Create user profile
    const newUserProfileData: Omit<User, 'uid' | 'createdAt' | 'updatedAt'> = {
      fullName: registrationData.fullName,
      email: registrationData.email,
      phoneNumber: registrationData.phoneNumber || '',
      residencyLocation: registrationData.residencyLocation || '',
      maritalStatus: maritalStatus,
      role: role,
      active: registrationData.active ?? true,
      assignedHiyawMahider: registrationData.assignedHiyawMahider || null,
      pastor: registrationData.pastor || '',
      deputyPastor: registrationData.deputyPastor || '',
      firstLogin: true
    };

    await this.userService.createOrUpdateUserProfile(firebaseUser.uid, newUserProfileData);
    console.log('AuthService: User profile created/updated in Firestore.');

    // Send password reset email
    await sendPasswordResetEmail(this.auth, registrationData.email);
    console.log('AuthService: Password reset/login link email sent to:', registrationData.email);

    // Sign out the newly created user
    await signOut(this.auth);
    console.log('AuthService: Newly created user signed out.');

    // Restore admin session if possible
    if (adminUid) {
      try {
        // In a real app, you would need to re-authenticate the admin here
        // For now, we'll just notify the admin needs to log in again
        this.router.navigate(['/login'], {
          state: { message: 'User created successfully. Please log in again.' }
        });
      } catch (error) {
        console.error('AuthService: Admin session restoration failed:', error);
        throw new Error('User created but admin session could not be restored');
      }
    }

  } catch (error: any) {
    console.error('AuthService: User registration error:', error);
    throw this.translateFirebaseError(error);
  } finally {
    // Restart session timer if there's a current user
    if (this.auth.currentUser) {
      this.startSessionTimer();
    }
  }
}


  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_+=[]{}|;:,.<>?';
    let result = '';
    const length = 16;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async getUserRole(uid: string): Promise<string | undefined> {
    try {
      console.log('AuthService: Attempting to get user role for UID:', uid);
      const userDoc = await firstValueFrom(this.userService.getUser(uid));
      console.log('AuthService: User role doc:', userDoc?.role);
      return userDoc?.role;
    } catch (error) {
      console.error('AuthService: Error fetching user role:', error);
      throw new Error('Failed to fetch user role');
    }
  }

  async logout(): Promise<void> {
    console.log('AuthService: Logging out...');
    this.stopSessionTimer(); // Stop timer on logout
    await signOut(this.auth);
    this.router.navigate(['/login']);
    console.log('AuthService: Logged out and redirected to /login.');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    console.log('AuthService: Attempting password change for user:', user?.uid);

    if (!user || !user.email) {
      this.router.navigate(['/login']);
      throw new Error('Authentication required');
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      console.log('AuthService: Password updated successfully.');

      const userDoc = await firstValueFrom(this.userService.getUser(user.uid));
      if (userDoc?.firstLogin) {
        await this.userService.updateUser(user.uid, { firstLogin: false });
        console.log('AuthService: firstLogin flag updated.');
      }
    } catch (error: any) {
      console.error('AuthService: Change password error:', error);
      throw this.translateFirebaseError(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      console.log('AuthService: Sending password reset email to:', email);
      await sendPasswordResetEmail(this.auth, email);
      console.log('AuthService: Password reset email sent.');
    } catch (error: any) {
      console.error('AuthService: Reset password error:', error);
      throw this.translateFirebaseError(error);
    }
  }

  getAssignedHiyawMahider(): Observable<string | null> {
    return this.authState$.pipe(
      map(user => user?.assignedHiyawMahider || null)
    );
  }

  private translateFirebaseError(error: any): Error {
    const messages: Record<string, string> = {
      'auth/wrong-password': 'Incorrect password',
      'auth/user-not-found': 'User not found',
      'auth/too-many-requests': 'Account temporarily locked',
      'auth/invalid-email': 'The email address is not valid.',
      'auth/email-already-in-use': 'This email address is already registered.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/invalid-credential': 'Invalid credentials provided.',
      'auth/operation-not-allowed': 'This operation is not allowed. Please contact support.',
    };

    return new Error(messages[error.code] || error.message || 'Authentication failed');
  }

  async getUserData(uid: string): Promise<{
    role: string,
    displayName: string,
    assignedHiyawMahiderId: string,
    assignedHiyawMahiderName: string
  } | null> {
    try {
      const userDoc = await firstValueFrom(this.userService.getUser(uid));

      if (!userDoc) return null;

      let hiyawMahiderName = '';
      if (userDoc.assignedHiyawMahider) {
        hiyawMahiderName = await firstValueFrom(
          this.hiyawMahiderService.getHiyawMahiderName(userDoc.assignedHiyawMahider)
        );
      }

      return {
        role: userDoc.role || 'Member',
        displayName: userDoc.fullName || 'Guest',
        assignedHiyawMahiderId: userDoc.assignedHiyawMahider || '',
        assignedHiyawMahiderName: hiyawMahiderName
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  private currentUserHiyawMahiders = new BehaviorSubject<string[]>([]);
  currentUserHiyawMahiders$ = this.currentUserHiyawMahiders.asObservable();

  setUserHiyawMahiders(hiyawMahiderIds: string[]) {
    this.currentUserHiyawMahiders.next(hiyawMahiderIds);
  }

  /**
   * Starts the session inactivity timer.
   * Listens for user activity and logs out if inactive for too long.
   */
  private startSessionTimer(): void {
    // Clear any existing timers/subscriptions to prevent duplicates
    this.stopSessionTimer();

    // Run outside Angular's change detection to prevent performance issues
    this.ngZone.runOutsideAngular(() => {
      // Create an observable that merges various user activity events
      const activityEvents = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'click'),
        fromEvent(document, 'scroll')
      ).pipe(
        debounceTime(500) // Debounce to avoid excessive calls on rapid movements
      );

      this.activityMonitorSubscription = activityEvents.subscribe(() => {
        // console.log('User activity detected, resetting timer.');
        this.resetSessionTimer();
      });
    });

    // Set the initial timeout
    this.resetSessionTimer();
    console.log(`AuthService: Session timer started for ${this.sessionTimeoutInMinutes} minutes.`);
  }

  /**
   * Resets the session inactivity timer.
   */
  private resetSessionTimer(): void {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => { // Run inside NgZone to trigger Angular's change detection for logout
        console.log('AuthService: Session timed out due to inactivity. Logging out...');
        this.logout();
      });
    }, this.sessionTimeoutInMinutes * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Stops the session inactivity timer and cleans up subscriptions.
   */
  private stopSessionTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      console.log('AuthService: Session timer cleared.');
    }
    if (this.activityMonitorSubscription) {
      this.activityMonitorSubscription.unsubscribe();
      this.activityMonitorSubscription = null;
      console.log('AuthService: Activity monitor unsubscribed.');
    }
  }

  // auth.service.ts
private adminPasswordStorageKey = 'admin_temp_credential';

async storeAdminPassword(password: string): Promise<void> {
  // More secure storage using crypto-js for basic encryption
  const encrypted = btoa(encodeURIComponent(password)); // Basic obfuscation
  sessionStorage.setItem(this.adminPasswordStorageKey, encrypted);
}

async getAdminPassword(): Promise<string | null> {
  const encrypted = sessionStorage.getItem(this.adminPasswordStorageKey);
  if (!encrypted) return null;
  try {
    return decodeURIComponent(atob(encrypted));
  } catch {
    return null;
  }
}

async clearStoredAdminPassword(): Promise<void> {
  sessionStorage.removeItem(this.adminPasswordStorageKey);
}
  
}