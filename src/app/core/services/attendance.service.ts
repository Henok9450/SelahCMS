import { Injectable, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  writeBatch,
  deleteField
} from '@angular/fire/firestore';
import { Attendance, HiyawMahiderStudyDay } from '../models/attendance.model';
import { User } from '../models/user.model';
import { HiyawMahider } from '../models/hiyaw-mahider.model';
import { Observable, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { AuditLogService } from './audit-log.service';

export interface MemberAttendance {
  userId: string;
  fullName: string;
  userName?: string;
  status: string;
  reason?: string;
}

export type SearchAttendanceResult = {
  id: string;
  date: Date;
  hiyawMahiderName: string;
  hiyawMahiderId: string;
  memberId: string;
  memberName: string;
  status: string;
  reason: string;
  members: MemberAttendance[];
};

export interface PaginatedAttendanceResponse {
  results: SearchAttendanceResult[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  constructor(
    private firestore: Firestore,
    private ngZone: NgZone,
    private auditLogService: AuditLogService
  ) { }

  private convertFirestoreDate(date: Date | Timestamp): Date {
    return date instanceof Timestamp ? date.toDate() : date;
  }

  private async getAttendanceDoc(attendanceDocId: string): Promise<Attendance | null> {
    const docRef = doc(this.firestore, 'attendances', attendanceDocId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as Attendance : null;
  }

  async createAttendance(attendance: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const attendanceRef = doc(collection(this.firestore, 'attendances'));
    const newAttendance: Attendance = {
      ...attendance,
      id: attendanceRef.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await setDoc(attendanceRef, newAttendance);
    await this.auditLogService.log(
      'ATTENDANCE_CREATED',
      'Attendance',
      attendanceRef.id,
      attendance.hiyawMahiderName,
      { studyDay: attendance.studyDay, date: attendance.date }
    );
    return attendanceRef.id;
  }

  async updateAttendance(attendanceId: string, updates: Partial<Attendance>): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceId);
    return updateDoc(attendanceRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async updateAttendanceMembers(attendanceId: string, members: MemberAttendance[]): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceId);
    return updateDoc(attendanceRef, {
      members: members,
      updatedAt: new Date()
    });
  }

  async getAttendanceForHiyawMahiderAndDate(hiyawMahiderId: string, date: Date): Promise<Attendance | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(this.firestore, 'attendances'),
      where('hiyawMahiderId', '==', hiyawMahiderId),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return {
        id: querySnapshot.docs[0].id,
        hiyawMahiderId: docData['hiyawMahiderId'],
        hiyawMahiderName: docData['hiyawMahiderName'],
        studyDay: docData['studyDay'],
        date: this.convertFirestoreDate(docData['date']),
        members: docData['members'] || [],
        createdAt: this.convertFirestoreDate(docData['createdAt']),
        updatedAt: this.convertFirestoreDate(docData['updatedAt'])
      } as Attendance;
    }
    return null;
  }

  async searchAttendance(
    params: {
      hiyawMahiderId?: string;
      memberId?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    pageIndex: number,
    pageSize: number
  ): Promise<PaginatedAttendanceResponse> {
    const conditions = [];

    if (params.hiyawMahiderId) {
      conditions.push(where('hiyawMahiderId', '==', params.hiyawMahiderId));
    }

    if (params.fromDate && params.toDate) {
      const startDate = new Date(params.fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(params.toDate);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(where('date', '>=', startDate));
      conditions.push(where('date', '<=', endDate));
    }

    const q = query(collection(this.firestore, 'attendances'), ...conditions);
    const querySnapshot = await getDocs(q);

    const allResults: SearchAttendanceResult[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const convertedDate = this.convertFirestoreDate(data['date']);

      (data['members'] || []).forEach((member: any) => {
        if (!params.memberId || member.userId === params.memberId) {
          allResults.push({
            id: docSnapshot.id,
            date: convertedDate,
            hiyawMahiderName: data['hiyawMahiderName'],
            memberId: member.userId,
            memberName: member.fullName,
            status: member.status,
            hiyawMahiderId: data['hiyawMahiderId'],
            members: data['members'] || [],
            reason: member.reason || '-'
          });
        }
      });
    });

    allResults.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      results: allResults.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
      totalCount: allResults.length
    };
  }

  async updateMemberAttendanceStatus(
    attendanceDocId: string,
    userId: string,
    newStatus: string,
    newReason: string
  ): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
    const attendanceData = await this.getAttendanceDoc(attendanceDocId);

    if (!attendanceData) {
      throw new Error(`Attendance document ${attendanceDocId} not found`);
    }

    const members = attendanceData.members || [];
    const memberIndex = members.findIndex(m => m.userId === userId);

    if (memberIndex === -1) {
      throw new Error(`Member ${userId} not found in attendance record`);
    }

    members[memberIndex] = {
      ...members[memberIndex],
      status: newStatus,
      reason: newReason
    };

    await updateDoc(attendanceRef, {
      members,
      updatedAt: new Date()
    });
  }

  async deleteMemberAttendanceRecord(attendanceDocId: string, userId: string): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
    const attendanceData = await this.getAttendanceDoc(attendanceDocId);

    if (!attendanceData) {
      throw new Error(`Attendance document ${attendanceDocId} not found`);
    }

    const members = (attendanceData.members || []).filter(m => m.userId !== userId);

    if (members.length === attendanceData.members?.length) {
      throw new Error(`Member ${userId} not found in attendance record`);
    }

    if (members.length === 0) {
      await this.deleteAttendanceDocument(attendanceDocId);
    } else {
      await updateDoc(attendanceRef, {
        members,
        updatedAt: new Date()
      });
    }
  }

  async deleteAttendanceDocument(attendanceId: string): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceId);
    const batch = writeBatch(this.firestore);
    batch.delete(attendanceRef);
    await batch.commit();
    await this.auditLogService.log('ATTENDANCE_DELETED', 'Attendance', attendanceId);
  }

  async setSpecialStudyDay(hiyawMahiderId: string, date: Date, studyDay: string, reason: string): Promise<void> {
    const studyDayQuery = query(
      collection(this.firestore, 'hiyawMahiderStudyDays'),
      where('hiyawMahiderId', '==', hiyawMahiderId)
    );
    const studyDaySnapshot = await getDocs(studyDayQuery);

    if (studyDaySnapshot.empty) {
      const newDocRef = doc(collection(this.firestore, 'hiyawMahiderStudyDays'));
      await setDoc(newDocRef, {
        hiyawMahiderId,
        defaultDay: 'Monday',
        specialDays: [{ date: Timestamp.fromDate(date), studyDay, reason }]
      });
    } else {
      const existingDocRef = studyDaySnapshot.docs[0].ref;
      const existingData = studyDaySnapshot.docs[0].data() as HiyawMahiderStudyDay;
      const currentSpecialDays = existingData.specialDays || [];

      const updatedSpecialDays = currentSpecialDays.map(sd => {
        const specialDayDate = this.convertFirestoreDate(sd.date);
        return specialDayDate.toDateString() === date.toDateString()
          ? { date: Timestamp.fromDate(date), studyDay, reason }
          : sd;
      });

      if (!updatedSpecialDays.some(sd =>
        this.convertFirestoreDate(sd.date).toDateString() === date.toDateString()
      )) {
        updatedSpecialDays.push({ date: Timestamp.fromDate(date), studyDay, reason });
      }

      await updateDoc(existingDocRef, {
        specialDays: updatedSpecialDays
      });
    }
  }

  async addMembersToAttendance(attendanceDocId: string, newMembers: MemberAttendance[]): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
    const attendanceData = await this.getAttendanceDoc(attendanceDocId);

    if (!attendanceData) {
      throw new Error('Attendance document not found');
    }

    const existingMembers = attendanceData.members || [];
    const uniqueNewMembers = newMembers.filter(nM =>
      !existingMembers.some(eM => eM.userId === nM.userId)
    );

    if (uniqueNewMembers.length === 0) {
      return;
    }

    await updateDoc(attendanceRef, {
      members: [...existingMembers, ...uniqueNewMembers],
      updatedAt: new Date()
    });
  }

  async getStudyDayForDate(hiyawMahiderId: string, date: Date): Promise<string> {
    const studyDaySettings = await getDocs(query(
      collection(this.firestore, 'hiyawMahiderStudyDays'),
      where('hiyawMahiderId', '==', hiyawMahiderId)
    ));

    if (!studyDaySettings.empty) {
      const settings = studyDaySettings.docs[0].data() as HiyawMahiderStudyDay;
      const specialDay = settings.specialDays?.find(sd => {
        const specialDayDate = this.convertFirestoreDate(sd.date);
        return specialDayDate.toDateString() === date.toDateString();
      });
      if (specialDay) return specialDay.studyDay;
    }
    return 'Monday';
  }

  async getAttendanceForMemberAndDate(memberId: string, date: Date): Promise<SearchAttendanceResult[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(this.firestore, 'attendances'),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );

    const querySnapshot = await getDocs(q);
    const results: SearchAttendanceResult[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const convertedDate = this.convertFirestoreDate(data['date']);

      (data['members'] || []).forEach((member: any) => {
        if (member.userId === memberId) {
          results.push({
            id: docSnapshot.id,
            date: convertedDate,
            hiyawMahiderName: data['hiyawMahiderName'],
            memberId: member.userId,
            memberName: member.fullName,
            status: member.status,
            hiyawMahiderId: data['hiyawMahiderId'],
            members: data['members'] || [],
            reason: member.reason || '-'
          });
        }
      });
    });

    return results;
  }

  getAttendanceCountsByHiyawMahider(
    hiyawMahiderId?: string,
    userId?: string | string[]
  ): Observable<{
    present: number;
    absent: number;
    excused: number;
    late: number;
    'new-guest': number;
    'follow-up-needed': number;
    rawRecords: any[];
  }> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 4);

    const conditions: any[] = [
      where('date', '>=', threeMonthsAgo)
    ];

    if (hiyawMahiderId) {
      conditions.push(where('hiyawMahiderId', '==', hiyawMahiderId));
    }

    const q = query(
      collection(this.firestore, 'attendances'),
      ...conditions
    );

    const targetUserIds = Array.isArray(userId)
      ? userId.filter(Boolean)
      : (userId ? [userId] : []);

    return new Observable(observer => {
      getDocs(q)
        .then(querySnapshot => {
          const counts = {
            present: 0,
            absent: 0,
            excused: 0,
            late: 0,
            'new-guest': 0,
            'follow-up-needed': 0,
          };

          const rawRecords: any[] = [];

          querySnapshot.forEach(docSnapshot => {
            const record = docSnapshot.data();
            rawRecords.push(record);

            (record['members'] || []).forEach((member: any) => {
              // If targetUserIds is provided, match by userId or memberId. If not, count all
              const matchesUser = targetUserIds.length === 0 ||
                targetUserIds.some(id => id === member.userId || id === member.memberId || id === member.id);

              if (matchesUser) {
                const status = (member['status'] || member['attendanceStatus']) as keyof typeof counts;
                if (status && counts.hasOwnProperty(status)) {
                  counts[status]++;
                }
              }
            });

          });

          observer.next({ ...counts, rawRecords });
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }
}
