import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, of, tap, throwError, timeout, retry, delay, shareReplay } from 'rxjs';
import { Member, MemberFilters, UserRole } from '../models/member.model';
import { HiyawMahider } from '../models/hiyaw-mahider.model';
import { Auth } from '@angular/fire/auth';

import { AuditLogService } from './audit-log.service';

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private readonly apiUrl = 'https://backend.main.api.geuc.et/api/v1';
  private readonly requestTimeout = 45000; // Increased to 45 seconds
  private readonly maxRetries = 3;
  // Simple in-memory cache for paged members
  private membersCache = new Map<string, { data: Member[]; meta: any; timestamp: number }>();
  private readonly cacheTTL = 60_000; // 1 minute

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: any,
    private auth: Auth,
    private auditLogService: AuditLogService
  ) { }

  // Method to get authentication headers
  private async getAuthHeaders(): Promise<HttpHeaders> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        console.log('🔑 Using Firebase ID token for API request');
        return new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        });
      } else {
        console.warn('⚠️ No authenticated user found');
        return new HttpHeaders({
          'Content-Type': 'application/json'
        });
      }
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
  }

  // Default: paginated fetch with cache
  getMembersPaged(filters: MemberFilters = {}): Observable<{ data: Member[], meta: any }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const cacheKey = JSON.stringify({ ...filters, page, pageSize });

    const cached = this.membersCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return of(cached);
    }

    return this.getMembers({ ...filters, page, pageSize }).pipe(
      tap(result => {
        this.membersCache.set(cacheKey, { ...result, timestamp: Date.now() });
      }),
      shareReplay(1)
    );
  }

  // Opt-in: aggressive fetch with safer limits for admin/export flows
  getAllMembersAggressive(filters: MemberFilters = {}, options?: { maxPages?: number; pageSize?: number }): Observable<{ data: Member[], meta: any }> {
    const pageSize = options?.pageSize ?? 75; // slightly smaller for responsiveness
    const maxPages = options?.maxPages ?? 8; // cap to avoid long runs

    return new Observable(observer => {
      const allMembers: Member[] = [];
      let completedPages = 0;
      const uniqueMemberIds = new Set<string>();
      let consecutiveEmptyPages = 0;
      const maxConsecutiveEmptyPages = 2;

      console.log(`🎯 Aggressively fetching up to ${maxPages} pages (size ${pageSize})...`);

      const fetchSequentialPages = async () => {
        for (let page = 1; page <= maxPages; page++) {
          try {
            console.log(`📄 Aggressive fetch page ${page}/${maxPages}...`);

            const pageData = await this.fetchMembersWithRetry({
              ...filters,
              page,
              pageSize
            });

            const pageMembers = pageData?.data || [];

            if (pageMembers.length === 0) {
              consecutiveEmptyPages++;
              console.log(`📭 Page ${page} returned 0 members (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages})`);
              if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) break;
              continue;
            }

            consecutiveEmptyPages = 0;

            const newMembers = pageMembers.filter(member => {
              if (uniqueMemberIds.has(member.id)) return false;
              uniqueMemberIds.add(member.id);
              return true;
            });

            allMembers.push(...newMembers);
            completedPages = page;

            console.log(`📊 Page ${page}: ${pageMembers.length} members (${newMembers.length} new), total ${allMembers.length}`);

            if (pageMembers.length < pageSize * 0.25 && page >= 4) {
              console.log('📉 Low count detected; stopping early.');
              break;
            }

            await this.delay(80);
          } catch (error) {
            consecutiveEmptyPages++;
            console.error(`❌ Error on page ${page}:`, error);
            if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) break;
          }
        }

        observer.next({
          data: allMembers,
          meta: {
            totalRecords: allMembers.length,
            totalPages: completedPages,
            uniqueMembers: uniqueMemberIds.size
          }
        });
        observer.complete();
      };

      fetchSequentialPages();
    });
  }
  // 🆕 NEW: Robust method to fetch members with retry logic
  private fetchMembersWithRetry(filters: MemberFilters): Promise<{ data: Member[], meta: any }> {
    return new Promise(async (resolve, reject) => {
      let retries = 0;

      const attemptFetch = async () => {
        try {
          const result = await this.getMembers(filters).pipe(
            timeout(this.requestTimeout),
            // Note: retry may not be available depending on rxjs version; this is a best-effort
            // If retry is not available in imports, this will be a no-op and the catch below will handle failures.
            // Use any available retry operator from rxjs/operators if needed.
            catchError(error => {
              console.error(`❌ Fetch failed after ${retries + 1} attempts:`, error);
              return throwError(() => error);
            })
          ).toPromise();

          if (!result) {
            // Defensive: if toPromise resolves to undefined (no emission), treat it as an error
            throw new Error('Empty result from members fetch');
          }

          resolve(result);
        } catch (error) {
          retries++;
          if (retries < this.maxRetries) {
            console.log(`🔄 Retrying fetch... (${retries}/${this.maxRetries})`);
            await this.delay(1000 * retries); // Exponential backoff
            attemptFetch();
          } else {
            reject(error);
          }
        }
      };

      attemptFetch();
    });
  }

  // 🆕 NEW: Utility method for delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🆕 IMPROVED: Main getMembers method with better error handling
  getMembers(filters: MemberFilters = {}): Observable<{ data: Member[], meta: any }> {
    console.log('🔍 Fetching members from API...');

    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        let params = new HttpParams();

        // Add pagination
        if (filters.page) {
          params = params.set('pagination[page]', filters.page.toString());
        }
        if (filters.pageSize) {
          params = params.set('pagination[pageSize]', filters.pageSize.toString());
        }

        // Add status filter
        if (filters.status) {
          params = params.set('filter[status]', filters.status);
        }

        // Add search filter (let backend handle fuzzy match); keep it minimal to avoid API 500s
        if (filters.search) {
          params = params.set('filter[search]', filters.search);
        }

        // Add filter for Hiyaw Mahider ID
        if (filters.hiyawMahiderId) {
          params = params.set('filter[hyaw_mahider_id]', filters.hiyawMahiderId);
          console.log(`🔎 Filtering by Hiyaw Mahider ID: ${filters.hiyawMahiderId}`);
        }

        // Add includes
        if (filters.includes && filters.includes.length > 0) {
          filters.includes.forEach((include: string) => {
            params = params.append('includes[]', include);
          });
        }

        // Cache busting parameter
        params = params.set('_t', Date.now().toString());

        const url = `${this.apiUrl}/auth/members-module/members`;
        console.log('📤 API Request URL:', url);

        this.http.get<any>(url, { headers, params, observe: 'response' }).pipe(
          timeout(this.requestTimeout),
          tap(response => {
            console.log('✅ API Response Status:', response.status);
          }),
          map(response => this.processApiResponse(response)),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ API ERROR:', error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (response) => observer.next(response),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        console.error('❌ Auth header error:', error);
        observer.error(this.handleApiError(error));
      });
    });
  }

  // 🆕 NEW: Process API response with better error handling
  private processApiResponse(response: any): { data: Member[], meta: any } {
    let members: Member[] = [];
    let meta: any = {};

    if (!response.body) {
      console.warn('⚠️ Empty response body');
      return { data: members, meta };
    }

    console.log('🔍 Analyzing GET response structure...');

    const responseBody = response.body;

    // Handle payload structure
    if (responseBody.payload) {
      if (Array.isArray(responseBody.payload)) {
        members = responseBody.payload.map((member: any) => this.mapApiMemberToMember(member));
        console.log(`✅ Using payload array structure: ${members.length} members`);
      } else if (responseBody.payload.data && Array.isArray(responseBody.payload.data)) {
        members = responseBody.payload.data.map((member: any) => this.mapApiMemberToMember(member));
        console.log(`✅ Using payload.data structure: ${members.length} members`);
      } else if (typeof responseBody.payload === 'object') {
        // Try to extract members from various possible structures
        if (responseBody.payload.members && Array.isArray(responseBody.payload.members)) {
          members = responseBody.payload.members.map((member: any) => this.mapApiMemberToMember(member));
        } else {
          // If it's a single member, wrap in array
          members = [this.mapApiMemberToMember(responseBody.payload)];
        }
        console.log(`✅ Extracted members from payload object: ${members.length} members`);
      }
    }
    // Handle data structure
    else if (responseBody.data && Array.isArray(responseBody.data)) {
      members = responseBody.data.map((member: any) => this.mapApiMemberToMember(member));
      console.log(`✅ Using data structure: ${members.length} members`);
    }
    // Handle direct array
    else if (Array.isArray(responseBody)) {
      members = responseBody.map((member: any) => this.mapApiMemberToMember(member));
      console.log(`✅ Using direct array structure: ${members.length} members`);
    } else {
      console.warn('⚠️ Unknown response structure:', responseBody);
    }

    // Extract metadata
    if (responseBody._attributes) {
      meta = responseBody._attributes;
    } else if (responseBody.meta) {
      meta = responseBody.meta;
    } else if (responseBody.payload && responseBody.payload.meta) {
      meta = responseBody.payload.meta;
    }

    console.log(`📊 Final mapped members: ${members.length}`);
    return { data: members, meta };
  }

  // 🆕 NEW: Better error handling
  private handleApiError(error: any): any {
    if (error.name === 'TimeoutError') {
      return {
        name: 'TimeoutError',
        message: 'Request timed out. Please check your internet connection and try again.',
        originalError: error
      };
    }

    if (error.status === 0) {
      return {
        name: 'NetworkError',
        message: 'Network error. Please check your internet connection.',
        originalError: error
      };
    }

    return error;
  }

  // 🆕 NEW: Debug method to check current member data from API
  getMemberById(memberId: string): Observable<Member> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        const url = `${this.apiUrl}/auth/members-module/members/${memberId}`;
        console.log('🔍 DEBUG: Fetching single member by ID:', memberId);

        // Add cache busting
        const params = new HttpParams().set('_t', Date.now().toString());

        this.http.get<any>(url, { headers, params }).pipe(
          timeout(10000), // Reduced timeout for single member
          tap(response => {
            console.log('🔍 DEBUG: Single member API response:', response);
          }),
          map(response => {
            let memberData: any;

            if (response.payload && typeof response.payload === 'object' && !Array.isArray(response.payload)) {
              memberData = response.payload;
              console.log('✅ DEBUG: Using payload object structure');
            } else if (response.payload && Array.isArray(response.payload) && response.payload.length > 0) {
              memberData = response.payload[0];
              console.log('✅ DEBUG: Using payload array structure');
            } else if (response.data) {
              memberData = response.data;
              console.log('✅ DEBUG: Using data structure');
            } else {
              memberData = response;
              console.log('✅ DEBUG: Using direct response');
            }

            return this.mapApiMemberToMember(memberData);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ DEBUG: Error fetching single member:', error);
            return throwError(() => error);
          })
        ).subscribe({
          next: (response) => observer.next(response),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  // Map API member to Member model with correct property names
  private mapApiMemberToMember(apiMember: any): Member {
    // Normalize Hiyaw Mahider ID from multiple possible shapes
    const hiyawId =
      apiMember.hyaw_mahider_id ??
      apiMember.hiyaw_mahider_id ??
      apiMember.hiyawMahiderId ??
      apiMember.hyawMahiderId ??
      apiMember.hiyaw_mahider?.id ??
      apiMember.hyaw_mahider?.id ??
      apiMember.hiyawMahider?.id ??
      apiMember.hyawMahider?.id;

    const member: Member = {
      id: apiMember.id,
      member_code: apiMember.member_code,
      first_name: apiMember.first_name,
      middle_name: apiMember.middle_name,
      last_name: apiMember.last_name,
      full_name: apiMember.full_name,
      nationality: apiMember.nationality,
      gender: apiMember.gender,
      birth_date: apiMember.birth_date,
      age: apiMember.age,
      registration_date: apiMember.registration_date,
      status: apiMember.status || 'active',
      is_child: apiMember.is_child || false,
      phone: apiMember.phone || apiMember.contact?.phone,
      email: apiMember.email || apiMember.contact?.email,
      contact: apiMember.contact,
      maritalStatus: apiMember.maritalStatus,
      smallTeam: apiMember.smallTeam || apiMember.small_team || apiMember.smallteam || apiMember.hiyawMahider || apiMember.hiyaw_mahider,
      hyaw_mahider_id: hiyawId,
      departments: apiMember.departments,
      created_at: apiMember.created_at || apiMember.createdAt,
      updated_at: apiMember.updated_at || apiMember.updatedAt,
      role: apiMember.role || this.determineMemberRole(apiMember),
      firebase_uid: apiMember.firebase_uid
    };

    return member;
  }

  private determineMemberRole(apiMember: any): UserRole {
    const departments = apiMember.departments || [];

    if (departments.some((dept: any) =>
      dept.name && dept.name.toLowerCase().includes('admin'))) {
      return 'Admin';
    } else if (departments.some((dept: any) =>
      dept.name && dept.name.toLowerCase().includes('pastor'))) {
      return 'Pastor';
    } else if (departments.some((dept: any) =>
      dept.name && dept.name.toLowerCase().includes('deputy'))) {
      return 'Deputy Pastor';
    } else if (departments.some((dept: any) =>
      dept.name && dept.name.toLowerCase().includes('coordinator'))) {
      return 'Zone Coordinator';
    }
    return 'Member';
  }

  // Helper to validate a real Hiyaw Mahider ID (UUID-like or long id)
  private isValidHiyawMahiderId(value: any): boolean {
    if (value === null || value === undefined) return false;
    const str = value.toString().trim();
    if (!str || str === '0') return false;

    const lower = str.toLowerCase();
    if (['null', 'undefined', 'member', 'pastor', 'admin'].includes(lower)) {
      return false;
    }

    // Accept UUIDs or opaque ids with length >= 8
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(str)) return true;

    return str.length >= 8;
  }

  // 🆕 NEW: Fetch member by Firebase UID
  getMemberByFirebaseUid(uid: string): Observable<Member | null> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        // We filter by firebase_uid on the backend
        // Assuming your API supports filter[firebase_uid]=...
        const params = new HttpParams()
          .set('filter[firebase_uid]', uid)
          .set('includes[]', 'smallTeam') // Includes needed for role/team info
          .append('includes[]', 'small_team') // Add snake_case variant just in case
          .append('includes[]', 'hiyawMahider') // Add potential alias
          .set('_t', Date.now().toString());

        const url = `${this.apiUrl}/auth/members-module/members`;
        console.log(`🔍 Fetching member by Firebase UID: ${uid}`);

        this.http.get<any>(url, { headers, params, observe: 'response' }).pipe(
          timeout(this.requestTimeout),
          map(response => this.processApiResponse(response)),
          map(result => {
            // Expecting a single match
            if (result.data && result.data.length > 0) {
              console.log(`✅ Found member for UID ${uid}:`, result.data[0].full_name);
              return result.data[0];
            }
            console.warn(`⚠️ No member found for UID ${uid}`);
            return null;
          }),
          catchError((error: HttpErrorResponse) => {
            console.error(`❌ Error fetching member by UID ${uid}:`, error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (member) => observer.next(member),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(this.handleApiError(error));
      });
    });
  }

  // 🆕 NEW: Fetch member by email
  getMemberByEmail(email: string): Observable<Member | null> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        // Use 'filter[search]' as it is the standard search parameter for this API
        // 'filter[email]' seems to be unsupported or ignored by the backend
        const params = new HttpParams()
          .set('filter[search]', email)
          .set('includes[]', 'smallTeam')
          .set('_t', Date.now().toString());

        const url = `${this.apiUrl}/auth/members-module/members`;
        console.log(`🔍 Fetching member by Email (via search): ${email}`);

        this.http.get<any>(url, { headers, params, observe: 'response' }).pipe(
          timeout(this.requestTimeout),
          tap(rawResponse => {
            console.log(`🔍 [MemberService] Raw API Response for Email Search (${email}):`, JSON.stringify(rawResponse));
          }),
          map(response => this.processApiResponse(response)),
          map(result => {
            // Filter locally to ensure exact email match, as search might be fuzzy
            if (result.data && result.data.length > 0) {
              const exactMatch = result.data.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
              if (exactMatch) {
                console.log(`✅ Found member for Email ${email}:`, exactMatch.full_name);
                return exactMatch;
              }
              console.warn(`⚠️ Search returned results but no exact email match for ${email}`);
              return null;
            }
            console.warn(`⚠️ No member found for Email ${email} (via search)`);
            return null;
          }),
          catchError((error: HttpErrorResponse) => {
            console.error(`❌ Error fetching member by Email ${email}:`, error);
            // Don't error out, return null so we can try fallback
            return of(null);
          })
        ).subscribe({
          next: (member) => observer.next(member),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(this.handleApiError(error));
      });
    });
  }

  // 🆕 NEW: Emergency brute force search
  findMemberByEmailFallback(email: string): Observable<Member | null> {
    console.log(`🚨 STARTING FALLBACK: Brute force search for ${email}`);
    // Fetch up to 10 pages (enough for ~750 members) to find the user
    return this.getAllMembersAggressive({}, { maxPages: 10, pageSize: 75 }).pipe(
      map(result => {
        const allMembers = result.data;
        const match = allMembers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
        if (match) {
          console.log(`✅ FALLBACK SUCCESS: Found member manually in list:`, match.full_name);
          return match;
        }
        console.warn(`❌ FALLBACK FAILED: Scanned ${allMembers.length} members but did not find ${email}`);
        return null;
      }),
      catchError(err => {
        console.error('❌ FALLBACK ERROR:', err);
        return of(null);
      })
    );
  }

  // 🆕 NEW: Update generic member profile data (e.g., for linking firebase_uid)
  updateMemberProfile(memberId: string, data: Partial<Member> | any): Observable<Member> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        const url = `${this.apiUrl}/auth/members-module/members/${memberId}`;
        console.log(`🔄 Updating member profile for ${memberId}`, data);

        this.http.patch<any>(url, data, { headers }).pipe(
          timeout(this.requestTimeout),
          tap(response => console.log('✅ Member profile update response:', response)),
          map(response => {
            let memberData: any;
            if (response.payload && typeof response.payload === 'object' && !Array.isArray(response.payload)) {
              memberData = response.payload;
            } else if (response.payload && Array.isArray(response.payload) && response.payload.length > 0) {
              memberData = response.payload[0];
            } else if (response.data) {
              memberData = response.data;
            } else {
              memberData = response;
            }
            const mapped = this.mapApiMemberToMember(memberData);
            this.auditLogService.log('MEMBER_UPDATED', 'Member', memberId, mapped.full_name, data);
            return mapped;
          }),
          catchError((error: HttpErrorResponse) => {
            console.error(`❌ Error updating member profile for ${memberId}:`, error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (member) => observer.next(member),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(this.handleApiError(error));
      });
    });
  }


  // 🆕 IMPROVED: Update member role with better error handling
  updateMemberRole(memberId: string, newRole: UserRole): Observable<Member> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        const updateData = {
          role: newRole
        };

        const url = `${this.apiUrl}/auth/members-module/members/${memberId}`;
        console.log(`🔄 UPDATING ROLE: ${memberId} -> ${newRole}`);
        console.log('📤 URL:', url);
        console.log('📦 Payload:', JSON.stringify(updateData, null, 2));

        this.http.patch<any>(url, updateData, { headers }).pipe(
          timeout(15000),
          tap(response => {
            console.log('✅ ROLE UPDATE RESPONSE:', response);
          }),
          map(response => {
            const updatedMember: Member = {
              id: memberId,
              role: newRole,
              full_name: 'Updated Member',
              member_code: 'TEMP',
              status: 'active',
              first_name: '',
              last_name: '',
              is_child: false
            };
            this.auditLogService.log('ROLE_CHANGED', 'Member', memberId, undefined, { newRole });
            console.log('✅ ROLE UPDATE SUCCESS - Returning updated member');
            return updatedMember;
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ ROLE UPDATE ERROR:', error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (response) => observer.next(response),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        console.error('❌ Auth header error:', error);
        observer.error(this.handleApiError(error));
      });
    });
  }

  // 🆕 IMPROVED: Assign member to Hiyaw Mahider with pre-assignment check
  // In MemberService - Ensure proper error message formatting
  assignMemberToHiyawMahider(
    memberId: string,
    hiyawMahiderId: string | null,
    role: UserRole,
    currentHiyawName?: string,
    newHiyawName?: string,
    firebaseUid?: string // 🆕 NEW: Optional Firebase UID for sync
  ): Observable<Member> {
    return new Observable(observer => {
      // 1. Check if we are actually assigning (hiyawMahiderId is not null)
      if (hiyawMahiderId === null) {
        console.warn('⚠️ Null Hiyaw Mahider ID passed. Use removeMemberFromHiyawMahider() instead.');
        observer.error({
          name: 'InvalidOperationError',
          message: 'To remove a member, please use the dedicated removeMemberFromHiyawMahider method.'
        });
        return;
      }

      // 2. Fetch current member data for validation
      this.getMemberById(memberId).subscribe({
        next: (currentMember: Member) => {
          console.log('🔍 Pre-assignment validation for:', {
            member: currentMember.full_name,
            currentHiyawId: currentMember.hyaw_mahider_id,
            newHiyawId: hiyawMahiderId,
            currentHiyawName,
            newHiyawName
          });

          // Validation check: If already assigned and trying to assign to a new/same Hiyaw Mahider
          // Treat null/undefined/"null"/"undefined"/""/0 as unassigned to avoid false positives.
          const currentAssignment = currentMember.hyaw_mahider_id;
          const hasCurrentAssignment = this.isValidHiyawMahiderId(currentAssignment);

          console.log('🔎 Assignment validation state:', {
            memberId: memberId,
            currentAssignment,
            hasCurrentAssignment
          });

          if (hasCurrentAssignment) {

            // Case 1: Already assigned to the same ID
            if (currentMember.hyaw_mahider_id === hiyawMahiderId) {
              console.warn('⚠️ ASSIGNMENT BLOCKED: Member already assigned to this Hiyaw Mahider.');
              observer.error({
                name: 'ValidationConflictError',
                message: `Member ${currentMember.full_name} is already assigned to "${currentHiyawName || 'this Hiyaw Mahider'}". No change needed.`
              });
              return;
            }

            // Case 2: Already assigned to a different ID (Block reassignment for "Assign" action)
            console.error('❌ ASSIGNMENT BLOCKED: Member is already assigned to a different Hiyaw Mahider.');

            // Ensure we have a name to display
            const displayCurrentName = currentHiyawName || 'another Hiyaw Mahider';
            const displayNewName = newHiyawName || 'the new Hiyaw Mahider';

            observer.error({
              name: 'AssignmentConflictError',
              message: `Member ${currentMember.full_name} is currently assigned to "${displayCurrentName}". Please unassign them first before reassigning to "${displayNewName}".`
            });
            return;
          }

          // 3. If validation passes (member is unassigned), proceed with the actual PATCH request
          this.executeAssignmentPatch(memberId, hiyawMahiderId, role, observer, firebaseUid);
        },
        error: (error) => {
          // If fetching the member fails, report that error
          console.error('❌ Failed to fetch member data for pre-assignment validation:', error);
          observer.error(this.handleApiError(error));
        }
      });
    });
  }

  // 🆕 NEW: Helper method to get Hiyaw Mahider name from ID
  private getHiyawMahiderName(hiyawMahiderId: string, hiyawMahiders?: HiyawMahider[]): string {
    if (!hiyawMahiders || !hiyawMahiderId) return '';

    const hiyawMahider = hiyawMahiders.find(hm => hm.id === hiyawMahiderId);
    return hiyawMahider ? hiyawMahider.name : '';
  }

  // 🆕 NEW: Extracted method for the actual PATCH request
  private executeAssignmentPatch(memberId: string, hiyawMahiderId: string | null, role: UserRole, observer: any, firebaseUid?: string): void {
    this.getAuthHeaders().then(headers => {
      const updateData: any = {
        role: role,
        hyaw_mahider_id: hiyawMahiderId
      };

      // 🆕 NEW: Include firebase_uid if provided
      if (firebaseUid) {
        updateData.firebase_uid = firebaseUid;
        console.log(`🔗 Including Firebase UID in assignment: ${firebaseUid}`);
      }

      const url = `${this.apiUrl}/auth/members-module/members/${memberId}`;

      console.log(`🔄 Executing assignment PATCH: member ${memberId} to Hiyaw Mahider ${hiyawMahiderId} as ${role}`);

      this.http.patch<any>(url, updateData, { headers }).pipe(
        timeout(15000), // Increased timeout
        tap(response => {
          console.log('✅ Assignment raw response:', response);
        }),
        map(response => {
          // 🆕 FIX: Handle the actual API response structure
          let memberData: any;

          console.log('🔍 Analyzing assignment response structure...');

          if (response.payload && typeof response.payload === 'object' && !Array.isArray(response.payload)) {
            memberData = response.payload;
            console.log('✅ Using payload object structure for assignment');
          } else if (response.payload && Array.isArray(response.payload) && response.payload.length > 0) {
            memberData = response.payload[0];
            console.log('✅ Using payload array structure for assignment');
          } else if (response && response.id) {
            memberData = response;
            console.log('✅ Using direct response object for assignment');
          } else if (response.data) {
            memberData = response.data;
            console.log('✅ Using data object structure for assignment');
          } else if (response.message || response.success) {
            console.log('✅ Assignment successful, creating updated member object');
            memberData = {
              id: memberId,
              role: role,
              hyaw_mahider_id: hiyawMahiderId
            };
          } else {
            console.warn('⚠️ Unknown assignment response structure');
            console.log('📋 Available response keys:', Object.keys(response));
            memberData = {
              id: memberId,
              role: role,
              hyaw_mahider_id: hiyawMahiderId
            };
          }

          const updatedMember = this.mapApiMemberToMember(memberData);
          console.log('✅ Final mapped member after assignment:', updatedMember);
          return updatedMember;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Assignment failed:', error);
          return throwError(() => this.handleApiError(error));
        })
      ).subscribe({
        next: (response) => observer.next(response),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    }).catch(error => {
      observer.error(this.handleApiError(error));
    });
  }


  // 🆕 IMPROVED: Remove member from Hiyaw Mahider with better error handling
  removeMemberFromHiyawMahider(memberId: string): Observable<Member> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        const updateData = {
          hyaw_mahider_id: null  // Set to null to remove from Hiyaw Mahider
        };

        const url = `${this.apiUrl}/auth/members-module/members/${memberId}`;

        console.log(`🗑️ Removing member ${memberId} from Hiyaw Mahider by setting hyaw_mahider_id to null`);
        console.log('📤 URL:', url);
        console.log('📦 Payload:', JSON.stringify(updateData, null, 2));

        this.http.patch<any>(url, updateData, { headers }).pipe(
          timeout(15000), // Increased timeout
          tap(response => {
            console.log('✅ Removal successful:', response);
          }),
          map(response => {
            let memberData: any;

            if (response.payload && typeof response.payload === 'object' && !Array.isArray(response.payload)) {
              memberData = response.payload;
            } else if (response.payload && Array.isArray(response.payload) && response.payload.length > 0) {
              memberData = response.payload[0];
            } else if (response.data) {
              memberData = response.data;
            } else {
              memberData = response;
            }

            return this.mapApiMemberToMember(memberData);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Removal failed:', error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (response) => observer.next(response),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(this.handleApiError(error));
      });
    });
  }

  getRoleOptions(): UserRole[] {
    return ['Admin', 'Member', 'Pastor', 'Deputy Pastor', 'Zone Coordinator'];
  }

  // 🆕 IMPROVED: Test API connection with better error handling
  testApiConnection(): Observable<any> {
    console.log('🧪 Testing API connection...');

    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        const params = new HttpParams()
          .set('includes[]', 'contact')
          .set('pagination[pageSize]', '5')
          .set('_t', Date.now().toString());

        const url = `${this.apiUrl}/auth/members-module/members`;
        console.log('🧪 Test URL:', url);

        this.http.get<any>(url, { headers, params, observe: 'response' }).pipe(
          timeout(15000), // Increased timeout
          tap(response => {
            console.log('✅ API Connection Test: SUCCESS - Status:', response.status);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ API Connection Test: FAILED', error);
            return throwError(() => this.handleApiError(error));
          })
        ).subscribe({
          next: (response) => observer.next(response.body),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      }).catch(error => {
        observer.error(this.handleApiError(error));
      });
    });
  }
}
