import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, doc, getDoc, getDocs } from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { Observable, of, forkJoin, from } from 'rxjs';
import { DocumentData } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';


interface AttendanceRecord {
  id: string;
  date: Date;
  hiyawMahiderId: string;
  hiyawMahiderName: string;
  zone: string;
  members: AttendanceMember[];
}

export interface AttendanceMember {
  userId: string;
  fullName: string;
  status: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FollowUpReportService {
  constructor(private firestore: Firestore) {}

  getZones(): Observable<{id: string, name: string}[]> {
    const zonesRef = collection(this.firestore, 'zones');
    return collectionData(zonesRef, { idField: 'id' }) as Observable<{id: string, name: string}[]>;
  }

  getHiyawMahiders(): Observable<{id: string, name: string, zone: string}[]> {
    const mahidersRef = collection(this.firestore, 'hiyawMahiders');
    return collectionData(mahidersRef, { idField: 'id' }) as Observable<{id: string, name: string, zone: string}[]>;
  }

  getAttendanceRecords(filters: {
    startDate?: Date | string;
    endDate?: Date | string;
    zone?: string;
    hiyawMahider?: string;
  }): Observable<AttendanceRecord[]> {
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const rawEndDate = filters.endDate ? new Date(filters.endDate) : null; // Use a temporary variable
  
  const endDate = rawEndDate ? new Date(rawEndDate) : null; // Initialize endDate properly
  if (endDate) {
    endDate.setDate(endDate.getDate() + 1); // Adjust endDate to include the end of the day
  }

    let q = query(
      collection(this.firestore, 'attendances'),
      orderBy('date', 'desc')
    );

    if (startDate) {
      q = query(q, where('date', '>=', startDate));
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      q = query(q, where('date', '<', endOfDay));
    }

    if (filters.hiyawMahider && filters.hiyawMahider !== '') {
      q = query(q, where('hiyawMahiderId', '==', filters.hiyawMahider));
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map((records: DocumentData[]) => {
        return records.map((record: DocumentData) => {
          const recordDate = record['date'];
          const date = recordDate instanceof Timestamp
            ? recordDate.toDate()
            : recordDate?.toDate?.() || new Date();

          return {
            id: record['id'] as string,
            date: date,
            hiyawMahiderId: (record['hiyawMahiderId'] || record['mahiderId']) as string,
            hiyawMahiderName: (record['hiyawMahiderName'] || 'Unknown Mahider') as string,
            zone: '' as string, // Temporarily empty, will be populated with name
            members: ((record['members'] as any[]) || []).map(member => ({
              userId: member.userId as string,
              fullName: member.fullName as string,
              status: member.status?.toString().toLowerCase() as string,
              reason: member.reason as string | undefined
            } as AttendanceMember))
          } as AttendanceRecord;
        });
      }),
      switchMap((records: AttendanceRecord[]) => {
        if (records.length === 0) {
          return of([]);
        }

        const uniqueMahiderIds = Array.from(new Set(records.map(record => record.hiyawMahiderId)));

        const mahiderFetches = uniqueMahiderIds.map(mahiderId =>
          from(getDoc(doc(this.firestore, `hiyawMahiders/${mahiderId}`))).pipe(
            map(snapshot => snapshot.exists() ? ({ id: mahiderId, data: snapshot.data() }) : null),
            catchError(err => {
              console.warn(`Error fetching hiyawMahider ${mahiderId}:`, err);
              return of(null);
            })
          )
        );

        return forkJoin(mahiderFetches).pipe(
          map(mahiderSnapshots => {
            const mahiderZoneIdMap = new Map<string, string>();
            mahiderSnapshots.forEach(snap => {
              if (snap?.data) {
                mahiderZoneIdMap.set(snap.id, snap.data['zone']);
              }
            });

            records.forEach(record => {
              record.zone = mahiderZoneIdMap.get(record.hiyawMahiderId) || '';
            });

            if (filters.zone && filters.zone !== '') {
                return records.filter(record => record.zone === filters.zone);
            }
            return records;
          })
        );
      }),
      switchMap((recordsWithZoneIds: AttendanceRecord[]) => {
        if (recordsWithZoneIds.length === 0) {
          return of([]);
        }

        const uniqueZoneIds = Array.from(new Set(recordsWithZoneIds
            .map(record => record.zone)
            .filter(zoneId => zoneId !== '')
        ));

        if (uniqueZoneIds.length === 0) {
          recordsWithZoneIds.forEach(record => record.zone = 'Unknown');
          return of(recordsWithZoneIds);
        }

        const zoneNameFetches = uniqueZoneIds.map(zoneId =>
          from(getDoc(doc(this.firestore, `zones/${zoneId}`))).pipe(
            map(snapshot => snapshot.exists() ? ({ id: zoneId, name: snapshot.data()?.['name'] }) : null),
            catchError(err => {
              console.warn(`Error fetching zone ${zoneId}:`, err);
              return of(null);
            })
          )
        );

        return forkJoin(zoneNameFetches).pipe(
          map(zoneNameSnapshots => {
            const zoneNameMap = new Map<string, string>();
            zoneNameSnapshots.forEach(snap => {
              if (snap?.name) {
                zoneNameMap.set(snap.id, snap.name);
              }
            });

            recordsWithZoneIds.forEach(record => {
              record.zone = zoneNameMap.get(record.zone) || 'Unknown';
            });

            return recordsWithZoneIds;
          })
        );
      }),
      catchError((err: Error) => {
        console.error('Error fetching records:', err);
        return of([]);
      })
    );
  }

  getFollowUpMembers(records: AttendanceRecord[]): {absentMembers: any[], followUpNeededMembers: any[]} {
  const memberRecordsMap: {[userId: string]: any[]} = {};

    records.forEach(record => {
      record.members.forEach(member => {
        if (!memberRecordsMap[member.userId]) {
          memberRecordsMap[member.userId] = [];
        }
        memberRecordsMap[member.userId].push({
          ...member,
          date: record.date,
          hiyawMahiderName: record.hiyawMahiderName,
          zone: record.zone
        });
      });
    });

    return {
      absentMembers: this.findConsecutiveAbsences(memberRecordsMap),
      followUpNeededMembers: this.findFollowUpNeeded(memberRecordsMap)
    };
  }

  private findConsecutiveAbsences(memberRecordsMap: {[userId: string]: any[]}): any[] {
    const result: any[] = [];

    Object.keys(memberRecordsMap).forEach(userId => {
      const memberRecords = memberRecordsMap[userId]
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      
      let consecutiveCount = 0;
      let latestRecord = null;

      for (const record of memberRecords) {
        if (record.status === 'absent') {
          consecutiveCount++;
          if (!latestRecord) {
            latestRecord = record;
          }
        } else {
          break;
        }
      }

      if (consecutiveCount >= 4) {
        result.push({
          userId,
          fullName: latestRecord.fullName,
          hiyawMahiderName: latestRecord.hiyawMahiderName,
          zone: latestRecord.zone,
          consecutiveAbsences: consecutiveCount,
          lastAbsenceDate: latestRecord.date
        });
      }
    });

    return result;
  }

  private findFollowUpNeeded(memberRecordsMap: {[userId: string]: any[]}): any[] {
    const result: any[] = [];
  
    Object.keys(memberRecordsMap).forEach(userId => {
      const memberRecords = memberRecordsMap[userId];
      
      const followUpRecords = memberRecords.filter(r => 
        r.status && r.status.toString().toLowerCase().includes('follow')
      );
  
      if (followUpRecords.length > 0) {
        followUpRecords.forEach(record => {
          result.push({
            userId,
            fullName: record.fullName,
            hiyawMahiderName: record.hiyawMahiderName,
            zone: record.zone,
            followUpCount: followUpRecords.length,
            latestFollowUpDate: record.date,
            reason: record.reason || 'No reason provided'
          });
        });
      }
    });
  
    return result;
  }

  // MODIFIED: getMemberDetails to resolve Hiyaw Mahider Name
  getMemberDetails(userId: string): Observable<any> {
    if (!userId) {
      console.warn('No user ID provided');
      return of(null);
    }
  
    const userDocRef = doc(this.firestore, `users/${userId}`);
    return from(getDoc(userDocRef)).pipe(
      switchMap(userSnapshot => {
        if (!userSnapshot.exists()) {
          console.warn(`User ${userId} not found`);
          return of(null);
        }
        const userData = userSnapshot.data();
        const assignedHiyawMahiderId = userData?.['assignedHiyawMahider']; // Assuming this is the ID

        if (assignedHiyawMahiderId) {
          const mahiderDocRef = doc(this.firestore, `hiyawMahiders/${assignedHiyawMahiderId}`);
          return from(getDoc(mahiderDocRef)).pipe(
            map(mahiderSnapshot => {
              const mahiderName = mahiderSnapshot.exists()
                ? mahiderSnapshot.data()?.['name'] || 'Unknown Mahider'
                : 'Not assigned (Mahider not found)';
             
              return {
                ...userData,
                assignedHiyawMahider: mahiderName // Override with the name
              };
            }),
            catchError(mahiderError => {
              console.error(`Error loading Hiyaw Mahider ${assignedHiyawMahiderId}:`, mahiderError);
              return of({
                ...userData,
                assignedHiyawMahider: 'Error fetching Mahider name'
              });
            })
          );
        } else {
          // If no assignedHiyawMahiderId is present on the user document
          return of({
            ...userData,
            assignedHiyawMahider: 'Not assigned'
          });
        }
      }),
      catchError(userError => {
        console.error(`Error loading user ${userId}:`, userError);
        return of(null);
      })
    );
  }
}
