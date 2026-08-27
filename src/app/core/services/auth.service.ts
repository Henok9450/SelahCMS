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
import { firstValueFrom, Observable, of, BehaviorSubject, fromEvent, merge, Subscription } from 'rxjs';
import { User } from '../models/user.model';
import { Member } from '../models/member.model';
import { switchMap, map, catchError, tap, first, debounceTime, shareReplay } from 'rxjs/operators'; // Add debounceTime, shareReplay
import { AppRole, ROLES } from '../utils/role.utils';
import { doc, getDoc, Firestore, docData } from '@angular/fire/firestore';
import { HiyawMahiderService } from './hiyaw-mahider.service';
import { MemberService } from './member.service';
import { AuditLogService } from './audit-log.service';
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
  private sessionTimeoutInMinutes = 15;        // Total inactivity timeout (minutes)
  private warningBeforeLogoutSeconds = 120;    // Show warning this many seconds before logout
  private activityMonitorSubscription: Subscription | null = null;
  private timeoutId: any;      // fires logout (or warning → logout)
  private warningTimeoutId: any; // fires warning dialog

  /** Emits true when the session-timeout warning dialog should be shown */
  private _showSessionWarning = new BehaviorSubject<boolean>(false);
  readonly showSessionWarning$ = this._showSessionWarning.asObservable();

  /** Seconds remaining when warning was triggered (for the countdown UI) */
  warningCountdownSeconds = this.warningBeforeLogoutSeconds;

  constructor(
    private auth: Auth,
    private router: Router,
    private userService: UserService,
    private firestore: Firestore,
    private hiyawMahiderService: HiyawMahiderService,
    private memberService: MemberService, // Inject MemberService
    private ngZone: NgZone, // Inject NgZone
    private auditLogService: AuditLogService
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
          console.log(`AuthService: Firebase user found (${firebaseUser.uid}). Syncing with Membership API.`);

          // 🆕 CHANGED: Fetch from Membership API instead of Firestore
          return this.memberService.getMemberByFirebaseUid(firebaseUser.uid).pipe(
            switchMap(apiMember => {
              // Case 1: Member found by UID - Return it
              if (apiMember) {
                console.log('AuthService: Membership API found profile for:', apiMember.full_name);
                return of(apiMember);
              }

              // Case 2: Member NOT found by UID - Try finding by Email
              console.warn(`AuthService: No Membership API profile found for UID: ${firebaseUser.uid}. Trying fetch by Email...`);

              if (!firebaseUser.email) {
                console.warn('AuthService: Firebase user has no email. Cannot link account.');
                return of(null);
              }

              return this.memberService.getMemberByEmail(firebaseUser.email).pipe(
                switchMap(emailMember => {
                  if (emailMember) {
                    console.log(`AuthService: Found existing member by email (${emailMember.full_name}). Linking account...`);
                    // Link the accounts by updating the member's firebase_uid
                    return this.memberService.updateMemberProfile(emailMember.id, { firebase_uid: firebaseUser.uid }).pipe(
                      tap(updatedMember => {
                        console.log(`AuthService: Account linking successful for ${updatedMember.full_name}`);
                      }),
                      catchError(error => {
                        console.error('AuthService: Account linking failed:', error);
                        // Even if linking fails, we return the member so the user can log in (next time might work or manual fix)
                        return of(emailMember);
                      })
                    );
                  }
                  console.warn('AuthService: No profile found by Email filter. Attempting Brute Force Fallback...');

                  // 🆕 FAILSAFE: Try "Brute Force" search via manual list scanning
                  return this.memberService.findMemberByEmailFallback(firebaseUser.email!).pipe(
                    switchMap((fallbackMember: Member | null) => {
                      if (fallbackMember && fallbackMember.id) {
                        console.log(`AuthService: Found member via fallback scan! Linking account...`);
                        return this.memberService.updateMemberProfile(fallbackMember.id, { firebase_uid: firebaseUser.uid }).pipe(
                          catchError(err => {
                            console.error('AuthService: Fallback link failed', err);
                            return of(fallbackMember);
                          })
                        );
                      }
                      console.warn('AuthService: Fallback scan failed. User is truly new or Guest.');
                      return of(null);
                    })
                  );
                })
              );
            }),
            tap(apiMember => {
              // Logging handled inside switchMap now
            }),
            map(apiMember => {
              // Map API Member to User model
              const mergedUser: User = {
                uid: firebaseUser.uid,
                memberId: apiMember?.id, // Map backend UUID
                email: firebaseUser.email || apiMember?.email || '',
                fullName: apiMember?.full_name || firebaseUser.displayName || 'User',
                phoneNumber: apiMember?.phone || '',
                // Fallbacks/defaults for fields not in generic Member model but in User
                residencyLocation: '',
                maritalStatus: (apiMember?.maritalStatus as any) || 'Single',
                role: apiMember?.role || 'Member',
                assignedHiyawMahider: apiMember?.hyaw_mahider_id || null,
                pastor: '', // Additional details could be fetched if needed
                deputyPastor: '',
                active: apiMember?.status === 'active',
                firstLogin: false, // API doesn't track this flag usually, assume false or manage elsewhere
                displayName: firebaseUser.displayName || apiMember?.full_name || 'User',
                emailVerified: firebaseUser.emailVerified,
                createdAt: apiMember?.created_at ? new Date(apiMember.created_at) : new Date(),
                updatedAt: new Date()
              };
              console.log('AuthService: Merged user object (API Source):', mergedUser);
              return mergedUser;
            }),
            catchError(error => {
              console.error(`AuthService: Error fetching/linking API profile for UID ${firebaseUser.uid}:`, error);
              // Fallback to basic Firebase info if API fails
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
              return of(defaultUser);
            })
          );
        }
        console.log('AuthService: No Firebase user detected. Emitting null.');
        return of(null);
      }),
      shareReplay(1) // 🆕 PERFORMANCE FIX: Share the source value to avoid re-executing API calls for every subscriber
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
      await this.auditLogService.log('AUTH_LOGIN', 'Auth', result.user.uid, email);
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

      // await this.userService.createOrUpdateUserProfile(firebaseUser.uid, newUserProfileData);
      // console.log('AuthService: User profile created/updated in Firestore.');

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
      console.log('AuthService: Attempting to get user role (from API) for UID:', uid);
      const member = await firstValueFrom(this.memberService.getMemberByFirebaseUid(uid));
      console.log('AuthService: API User role:', member?.role);
      return member?.role;
    } catch (error) {
      console.error('AuthService: Error fetching user role from API:', error);
      // Fallback or rethrow? For now, rethrow to be safe or return undefined
      return undefined;
    }
  }

  async logout(isTimeout: boolean = false): Promise<void> {
    console.log('AuthService: Logging out...');
    const action = isTimeout ? 'AUTH_SESSION_TIMEOUT' : 'AUTH_LOGOUT';
    
    try {
      await this.auditLogService.log(action, 'Auth');
    } catch (err) {
      console.error('AuthService: Audit log failed during logout:', err);
    }
    
    this.stopSessionTimer();
    this._showSessionWarning.next(false);

    try {
      await signOut(this.auth);
    } catch (err) {
      console.error('AuthService: Firebase signOut error:', err);
    }

    this.ngZone.run(() => {
      this.router.navigate(['/login']);
    });
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

      // Note: First Login flag update logic would need to be moved to API if needed, 
      // or handled via specific endpoint. For now, we focused on auth/role.

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
    assignedHiyawMahiderName: string,
    memberId?: string
  } | null> {
    try {
      // 🆕 CHANGED: Fetch from MemberService instead of UserService
      const member = await firstValueFrom(this.memberService.getMemberByFirebaseUid(uid));
      console.log('🔍 [AuthService] getUserData member:', member);

      if (!member) {
        console.warn('⚠️ [AuthService] No member found for UID:', uid);
        return null;
      }

      let hiyawMahiderName = '';
      if (member.smallTeam && member.smallTeam.name) {
        console.log('✅ [AuthService] Found Hiyaw Mahider name in smallTeam:', member.smallTeam.name);
        hiyawMahiderName = member.smallTeam.name;
      } else if (member.hyaw_mahider_id) {
        console.log('⚠️ [AuthService] smallTeam missing, fetching by ID:', member.hyaw_mahider_id);
        // Fallback: Fetch explicitly if not in the include
        try {
          hiyawMahiderName = await firstValueFrom(
            this.hiyawMahiderService.getHiyawMahiderName(member.hyaw_mahider_id)
          );
          console.log('✅ [AuthService] Fetched Hiyaw Mahider name:', hiyawMahiderName);
        } catch (e) {
          console.warn('❌ [AuthService] Could not fetch Hiyaw Mahider name', e);
        }
      } else {
        console.warn('⚠️ [AuthService] No Hiyaw Mahider ID or smallTeam found on member object.');
      }

      return {
        role: member.role || 'Member',
        displayName: member.full_name || 'Guest',
        assignedHiyawMahiderId: member.hyaw_mahider_id || '',
        assignedHiyawMahiderName: hiyawMahiderName,
        memberId: member.id // Map backend UUID
      };
    } catch (error) {
      console.error('Error fetching user data from API:', error);
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
   * Listens for user activity and shows a warning dialog before logging out.
   */
  private startSessionTimer(): void {
    this.stopSessionTimer();

    this.ngZone.runOutsideAngular(() => {
      const activityEvents = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'click'),
        fromEvent(document, 'scroll')
      ).pipe(
        debounceTime(500)
      );

      this.activityMonitorSubscription = activityEvents.subscribe(() => {
        // Only reset if warning dialog is NOT currently showing
        if (!this._showSessionWarning.value) {
          this.resetSessionTimer();
        }
      });
    });

    this.resetSessionTimer();
    console.log(`AuthService: Session timer started for ${this.sessionTimeoutInMinutes} minutes.`);
  }

  /**
   * Resets both the warning and the logout timers.
   */
  private resetSessionTimer(): void {
    clearTimeout(this.timeoutId);
    clearTimeout(this.warningTimeoutId);

    const totalMs  = this.sessionTimeoutInMinutes * 60 * 1000;
    const warnMs   = totalMs - (this.warningBeforeLogoutSeconds * 1000);

    // Schedule warning dialog
    this.warningTimeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        console.log('AuthService: Showing session timeout warning dialog.');
        this.warningCountdownSeconds = this.warningBeforeLogoutSeconds;
        this._showSessionWarning.next(true);
      });
    }, warnMs > 0 ? warnMs : 0);

    // Schedule actual logout
    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        console.log('AuthService: Session timed out due to inactivity. Logging out...');
        this._showSessionWarning.next(false);
        this.logout(true);
      });
    }, totalMs);
  }

  /**
   * Called when the user clicks "Stay Logged In" in the warning dialog.
   * Hides the dialog and resets the full inactivity timer.
   */
  extendSession(): void {
    console.log('AuthService: User extended session.');
    this._showSessionWarning.next(false);
    this.resetSessionTimer();
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
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    if (this.activityMonitorSubscription) {
      this.activityMonitorSubscription.unsubscribe();
      this.activityMonitorSubscription = null;
      console.log('AuthService: Activity monitor unsubscribed.');
    }
    this._showSessionWarning.next(false);
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
