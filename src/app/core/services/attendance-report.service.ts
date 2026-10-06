
// src/app/core/services/attendance-report.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, DocumentData, Query, orderBy, doc, getDoc } from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { Observable, of, from, combineLatest } from 'rxjs'; // Import 'from' for converting Promise to Observable
import { MemberService } from './member.service';


export interface HiyawMahider {
  id: string;
  code: string;
  createdDate: string;
  deputyPastor: string;
  location: string;
  name: string;
  pastor: string;
  status: string;
  studyDay: string;
  studyTime: string;
  zone: string;
  zoneName?: string;
  HostName?: string;
  HostContactNumber?: string;
  nameLower?: string; // Added for search functionality
}

export interface HiyawMahiderReportData {
  totalHiyawMahiders: number;
  activeCount: number;
  inactiveCount: number;
  byZone: { [zoneId: string]: number };
  byStudyDay: { [day: string]: number };
  hiyawMahiders: HiyawMahider[];
}

export interface AttendanceRecord {
  date: string; // This will store the formatted date for display
  hiyawMahiderId: string;
  hiyawMahiderName: string;
  zone: string;
  zoneName?: string;
  studyDay: string;
  members: { fullName: string; status: string; reason?: string }[];
}

export interface AttendanceReportSummary {
  totalRecords: number; // Total number of attendance entries (rows in the flat table)
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  lateCount: number;
  newGuestCount: number;
  followUpNeededCount: number;
  attendanceRate: number; // Professional: (Present + Late) / Expected Members
  participationRate: number; // Includes guests: (Present + Late + Guests) / (Expected + Guests)
  averageWeeklyAttendance: number; // AWA: Total attendees / number of weeks
  totalExpectedMembers: number; // Total records minus excused
  records: AttendanceRecord[];
}


@Injectable({
  providedIn: 'root'
})
export class AttendanceReportService {
  constructor(private firestore: Firestore, private memberService: MemberService) { }

  getHiyawMahiders(filters: any = {}): Observable<HiyawMahider[]> {
    const hiyawMahidersCollection = collection(this.firestore, 'hiyawMahiders');
    let q: Query<DocumentData>;

    if (filters.id) {
      // If a specific ID is provided, fetch that single document
      return from(getDoc(doc(hiyawMahidersCollection, filters.id))).pipe(
        map(snapshot => {
          if (snapshot.exists()) {
            return [this.transformHiyawMahiderData({ id: snapshot.id, ...snapshot.data() })];
          } else {
            return [];
          }
        }),
        catchError(error => {
          console.error('Service: Error fetching single Hiyaw Mahider by ID:', error);
          return of([]);
        })
      );
    } else {
      let q: Query<DocumentData> = hiyawMahidersCollection;

      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.zone) {
        q = query(q, where('zone', '==', filters.zone));
      }
      if (filters.studyDay) {
        q = query(q, where('studyDay', '==', filters.studyDay));
      }

      return collectionData(q, { idField: 'id' }).pipe(
        map(records => {
          let mahiders = records.map(record => this.transformHiyawMahiderData(record));
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase().trim();
            mahiders = mahiders.filter(m => (m.name && m.name.toLowerCase().includes(term)));
          }
          return mahiders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }),
        tap(records => console.log('Processed Hiyaw Mahider records:', records)),
        catchError(error => {
          console.error('Service: Error fetching Hiyaw Mahiders:', error);
          return of([]);
        })
      );
    }
  }


  transformHiyawMahiderData(record: any): HiyawMahider {
    return {
      id: record.id || 'N/A',
      code: record.code || 'N/A',
      createdDate: this.formatDate(record.createdDate),
      deputyPastor: record.deputyPastor || 'N/A',
      location: record.location || 'N/A',
      name: record.name || 'N/A',
      pastor: record.pastor || 'N/A',
      status: record.status || 'N/A',
      studyDay: record.studyDay || 'N/A',
      studyTime: record.studyTime || 'N/A',
      zone: record.zone || 'N/A',
      HostName: record.HostName || 'N/A',
      HostContactNumber: record.HostContactNumber || record.hostContactNumber || 'N/A',
      nameLower: record.nameLower || 'N/A'
    };
  }

  getZones(): Observable<{ id: string, name: string }[]> {
    const zonesCollection = collection(this.firestore, 'zones');
    return collectionData(zonesCollection, { idField: 'id' }).pipe(
      map((zones: DocumentData[]) =>
        zones.map((z: any) => ({ id: z['id'], name: z['name'] }))
      ),
      tap(zones => {
        console.log('Service: Fetched Zones from Firestore:', zones);
      }),
      catchError(error => {
        console.error('Service: Error fetching zones:', error);
        return of([]); // Return an empty array to prevent breaking the app if zones fail to load
      })
    );
  }

  generateHiyawMahiderReport(hiyawMahiders: HiyawMahider[], zones: { id: string, name: string }[] = []): HiyawMahiderReportData {
    console.log('Service: Generating report with Hiyaw Mahiders:', hiyawMahiders);
    console.log('Service: Zones provided for report generation:', zones);
    // Enhance hiyawMahiders with zone names if zones are provided
    const enhancedHiyawMahiders = zones.length > 0
      ? hiyawMahiders.map(hm => ({
        ...hm,
        zoneName: zones.find(z => z.id === hm.zone)?.name || 'Unknown Zone'
      }))
      : hiyawMahiders;

    const activeCount = enhancedHiyawMahiders.filter(hm => hm.status === 'Active').length;
    const inactiveCount = enhancedHiyawMahiders.length - activeCount;

    // Group by zone
    const byZone: { [zoneId: string]: number } = {};
    enhancedHiyawMahiders.forEach(hm => {
      const zoneKey = zones.length > 0
        ? (zones.find(z => z.id === hm.zone)?.name || hm.zone)
        : hm.zone;
      byZone[zoneKey] = (byZone[zoneKey] || 0) + 1;
    });

    // Group by study day
    const byStudyDay: { [day: string]: number } = {};
    enhancedHiyawMahiders.forEach(hm => {
      byStudyDay[hm.studyDay] = (byStudyDay[hm.studyDay] || 0) + 1;
    });

    return {
      totalHiyawMahiders: enhancedHiyawMahiders.length,
      activeCount,
      inactiveCount,
      byZone,
      byStudyDay,
      hiyawMahiders: enhancedHiyawMahiders
    };
  }

  // Method to get attendance records with strict zone filtering
  getAttendanceRecords(filters: any = {}, zones: { id: string, name: string }[] = []): Observable<AttendanceRecord[]> {
    console.log('%c[Service][getAttendanceRecords] METHOD ENTERED. Starting query construction...', 'color: blue; font-weight: bold;');

    return this.getHiyawMahiders().pipe(
      switchMap(hiyawMahiders => {
        // Create maps of id -> zone and name -> zone
        const mahiderIdToZoneMap = new Map<string, string>();
        const mahiderNameToZoneMap = new Map<string, string>();

        hiyawMahiders.forEach(mahider => {
          if (mahider.id) {
            mahiderIdToZoneMap.set(mahider.id, mahider.zone);
          }
          if (mahider.name) {
            mahiderNameToZoneMap.set(mahider.name.trim().toLowerCase(), mahider.zone);
          }
        });

        console.log('[Service][getAttendanceRecords] Hiyaw Mahiders loaded count:', hiyawMahiders.length);
        console.log('[Service][getAttendanceRecords] Filters received:', filters);

        // If zone filter is specified, check if that zone actually has any Hiyaw Mahiders
        let mahiderIdsInZone: string[] = [];
        if (filters.zone) {
          const mahidersInZone = hiyawMahiders.filter(m => m.zone === filters.zone);
          // If the selected zone has NO Hiyaw Mahiders at all, attendance is guaranteed to be 0
          if (mahidersInZone.length === 0) {
            console.warn(`[Service][getAttendanceRecords] No Hiyaw Mahiders found in zone: ${filters.zone}. Returning 0 records.`);
            return of([]);
          }
          mahiderIdsInZone = mahidersInZone.map(m => m.id);
        }

        const attendanceCollection = collection(this.firestore, 'attendances');
        let q: Query<DocumentData> = query(attendanceCollection, orderBy('date', 'desc'));

        // Apply hiyawMahiderId filter if specified
        if (filters.hiyawMahiderId) {
          q = query(q, where('hiyawMahiderId', '==', filters.hiyawMahiderId));
          console.log('[Service][getAttendanceRecords] Applied hiyawMahiderId filter:', filters.hiyawMahiderId);
        } else if (filters.zone && mahiderIdsInZone.length > 0 && mahiderIdsInZone.length <= 30) {
          q = query(q, where('hiyawMahiderId', 'in', mahiderIdsInZone));
          console.log('[Service][getAttendanceRecords] Applied zone filter via hiyawMahiderIds:', mahiderIdsInZone);
        }

        if (filters.studyDay) {
          q = query(q, where('studyDay', '==', filters.studyDay));
          console.log('[Service][getAttendanceRecords] Applied studyDay filter:', filters.studyDay);
        }

        // Date filtering
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          startDate.setHours(0, 0, 0, 0);
          q = query(q, where('date', '>=', startDate));
          console.log(`[Service][getAttendanceRecords] Applied startDate filter: >= ${startDate.toISOString()}`);
        }

        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          q = query(q, where('date', '<=', endDate));
          console.log(`[Service][getAttendanceRecords] Applied endDate filter: <= ${endDate.toISOString()}`);
        }

        console.log('%c[Service][getAttendanceRecords] Final query constructed', 'color: purple; font-weight: bold;');

        return collectionData(q, { idField: 'id' }).pipe(
          tap(rawRecords => {
            console.log(`[Service][getAttendanceRecords] RAW data (length: ${rawRecords.length}):`, rawRecords);
          }),
          map(rawRecords => {
            return rawRecords
              .map(record => {
                const typedRecord = record as { hiyawMahiderId?: string; hiyawMahiderName?: string; zone?: string; [key: string]: any };
                const recId = typedRecord.hiyawMahiderId || '';
                const recName = typedRecord.hiyawMahiderName ? typedRecord.hiyawMahiderName.trim().toLowerCase() : '';

                // Map to zone accurately
                const zone = (recId && mahiderIdToZoneMap.get(recId))
                  || (recName && mahiderNameToZoneMap.get(recName))
                  || typedRecord.zone
                  || 'N/A';

                return {
                  ...this.transformAttendanceRecordData({ ...record, zone }, zones),
                  zone,
                  zoneName: zones.find(z => z.id === zone)?.name || 'N/A'
                };
              })
              .filter(record => {
                // Strictly enforce zone filtering
                if (filters.zone && record.zone !== filters.zone) {
                  return false;
                }
                // Strictly enforce hiyawMahiderId filtering
                if (filters.hiyawMahiderId && record.hiyawMahiderId !== filters.hiyawMahiderId) {
                  return false;
                }
                // Strictly enforce studyDay filtering
                if (filters.studyDay && record.studyDay !== filters.studyDay) {
                  return false;
                }
                return true;
              });
          }),
          tap(transformedRecords => {
            console.log(`[Service][getAttendanceRecords] Transformed & filtered records count: ${transformedRecords.length}`);
          })
        );
      }),
      catchError(error => {
        console.error('[Service][getAttendanceRecords] Error:', error);
        return of([]);
      })
    );
  }
  /**
   * Fetches member full names for a given Hiyaw Mahider from the REST API.
   * Replaces the legacy Firestore /users query.
   */
  getUsersByHiyawMahider(hiyawMahiderId: string): Observable<string[]> {
    if (!hiyawMahiderId) {
      return of([]);
    }
    return this.memberService.getMembers({
      hiyawMahiderId,
      status: 'active',
      pageSize: 200
    }).pipe(
      map(response =>
        (response.data || [])
          .map(m => m.full_name || 'Unknown Member')
          .filter(name => !!name)
          .sort()
      ),
      catchError(error => {
        console.error('Service: Error fetching members by Hiyaw Mahider via REST API:', error);
        return of([]);
      })
    );
  }

  /**
   * Returns the expected member count for the given filters from the REST API.
   * Replaces the legacy Firestore /users count queries.
   */
  getOverallExpectedMembersCount(filters: any = {}): Observable<number> {
    const apiFilters: any = { status: 'active', pageSize: 1 };

    if (filters.hiyawMahiderId) {
      apiFilters.hiyawMahiderId = filters.hiyawMahiderId;
    }

    // If filtering by zone but not a specific hiyaw mahider,
    // collect all hiyaw mahiders in that zone first, then sum counts.
    if (filters.zone && !filters.hiyawMahiderId) {
      return this.getHiyawMahiders({ zone: filters.zone }).pipe(
        switchMap(hiyawMahidersInZone => {
          if (hiyawMahidersInZone.length === 0) return of(0);
          // Fetch count per hiyaw mahider and sum
          const countRequests = hiyawMahidersInZone.map(hm =>
            this.memberService.getMembers({ hiyawMahiderId: hm.id, status: 'active', pageSize: 1 }).pipe(
              map(res => res.meta?.totalRecords ?? res.data?.length ?? 0),
              catchError(() => of(0))
            )
          );
          return combineLatest(countRequests).pipe(
            map((counts: number[]) => counts.reduce((a: number, b: number) => a + b, 0))
          );
        }),
        catchError(() => of(0))
      );
    }

    return this.memberService.getMembers(apiFilters).pipe(
      map(response => {
        // Prefer server-reported total if available
        const serverTotal = response.meta?.totalRecords ?? response.meta?.total;
        return serverTotal ?? (response.data?.length ?? 0);
      }),
      catchError(error => {
        console.error('Service: Error fetching expected members count from REST API:', error);
        return of(0);
      })
    );
  }

  transformAttendanceRecordData(record: any, zones: { id: string, name: string }[] = []): AttendanceRecord {
    const zoneId = record.zone || 'N/A';
    const zoneName = zones.find(z => z.id === zoneId)?.name || 'N/A';

    return {
      date: this.formatDate(record.date),
      hiyawMahiderId: record.hiyawMahiderId || 'N/A',
      hiyawMahiderName: record.hiyawMahiderName || 'N/A',
      zone: zoneId,
      zoneName: zoneName,
      studyDay: record.studyDay || 'N/A',
      members: record.members || []
    };
  }

  // NEW: Generate Attendance Report Summary
  generateAttendanceReport(
    attendanceRecords: AttendanceRecord[],
    memberFilters: { memberName: string; status: string },
    totalExpectedMembersOverall: number
  ): AttendanceReportSummary {
    let filteredRecords: AttendanceRecord[] = attendanceRecords;

    // Apply member name and status filters within each record
    if (memberFilters.memberName || memberFilters.status) {
      filteredRecords = attendanceRecords.map(record => {
        const filteredMembers = record.members.filter(member => {
          const matchesMemberName = memberFilters.memberName ? member.fullName === memberFilters.memberName : true;
          const matchesStatus = memberFilters.status ? member.status === memberFilters.status : true;
          return matchesMemberName && matchesStatus;
        });
        return { ...record, members: filteredMembers };
      }).filter(record => record.members.length > 0); // Only keep records that still have members after filtering
    }

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;
    let newGuestCount = 0;
    let followUpNeededCount = 0;
    let totalActualAttendees = 0;

    filteredRecords.forEach(record => {
      record.members.forEach(member => {
        switch (member.status) {
          case 'present':
            presentCount++;
            totalActualAttendees++;
            break;
          case 'absent':
            absentCount++;
            break;
          case 'excused':
            excusedCount++;
            break;
          case 'late':
            lateCount++;
            totalActualAttendees++;
            break;
          case 'new-guest':
            newGuestCount++;
            totalActualAttendees++;
            break;
          case 'follow-up-needed':
            followUpNeededCount++;
            break;
        }
      });
    });

    const totalRecords = presentCount + absentCount + excusedCount + lateCount + newGuestCount + followUpNeededCount;

    // Professional Church Attendance Calculations
    // Expected Members = Regular members only (excludes excused who informed ahead AND new guests who are visitors)
    const totalExpectedMembers = totalRecords - excusedCount - newGuestCount;

    // Attendance Rate: Core members who attended (Present + Late) / Expected Members
    // Industry Standard: Excludes new guests (not regular members) and excused absences
    let attendanceRate = 0;
    if (totalExpectedMembers > 0) {
      const coreAttendees = presentCount + lateCount;
      attendanceRate = (coreAttendees / totalExpectedMembers) * 100;
    }

    // Participation Rate: All physical attendees including guests
    let participationRate = 0;
    const totalParticipants = presentCount + lateCount + newGuestCount;
    const totalPossibleParticipants = totalExpectedMembers + newGuestCount;
    if (totalPossibleParticipants > 0) {
      participationRate = (totalParticipants / totalPossibleParticipants) * 100;
    }

    // Average Weekly Attendance (AWA): Calculate if we have date range
    let averageWeeklyAttendance = 0;
    if (filteredRecords.length > 0) {
      // Get unique dates to count weeks
      const uniqueDates = new Set(filteredRecords.map(r => r.date));
      const numberOfSessions = uniqueDates.size;

      if (numberOfSessions > 0) {
        // AWA = Total attendees across all sessions / number of sessions
        averageWeeklyAttendance = totalParticipants / numberOfSessions;
      }
    }

    return {
      totalRecords,
      presentCount,
      absentCount,
      excusedCount,
      lateCount,
      newGuestCount,
      followUpNeededCount,
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
      participationRate: parseFloat(participationRate.toFixed(2)),
      averageWeeklyAttendance: parseFloat(averageWeeklyAttendance.toFixed(1)),
      totalExpectedMembers,
      records: filteredRecords
    };
  }

  // Renamed and adapted export method for attendance records
  exportAttendanceRecordsToCSV(data: any[], filename: string) { // Data is now the flattened records
    if (!data || data.length === 0) {
      console.error('No data to export');
      return;
    }

    const csvRows = [];
    const headers = [
      'Date', 'Hiyaw Mahider', 'Zone', 'Member Name', 'Study Day', 'Status', 'Reason'
    ];

    csvRows.push(headers.join(','));

    for (const record of data) {
      const values = [
        `"${(record.date || '').replace(/"/g, '""')}"`,
        `"${(record.hiyawMahiderName || '').replace(/"/g, '""')}"`,
        `"${(record.zone || '').replace(/"/g, '""')}"`,
        `"${(record.memberName || '').replace(/"/g, '""')}"`,
        `"${(record.studyDay || '').replace(/"/g, '""')}"`,
        `"${(record.status || '').replace(/"/g, '""')}"`,
        `"${(record.reason || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    this.downloadFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  private formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';

    try {
      if (dateInput.toDate) { // This handles Firestore Timestamp objects
        return dateInput.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) { // Handles JavaScript Date objects or strings parsable by Date
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }

    return 'N/A';
  }

  // IMPORTANT: This method is now REMOVED as it was causing the date comparison issue.
  // private formatDateForFirestore(date: Date): string {
  //   return date.toISOString().slice(0, 10);
  // }

  private downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
