import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, query, where, getDocs, Timestamp, writeBatch, deleteField } from '@angular/fire/firestore';
import { Attendance, HiyawMahiderStudyDay } from '../core/attendance.model';
import { User } from '../core/user.model';
import { HiyawMahider } from '../core/hiyaw-mahider.model';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  constructor(private firestore: Firestore) {}

  private convertFirestoreDate(date: Date | Timestamp): Date {
    return date instanceof Timestamp ? date.toDate() : date;
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
    return attendanceRef.id;
  }

  async updateAttendance(attendanceId: string, updates: Partial<Attendance>): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceId);
    return updateDoc(attendanceRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async updateAttendanceMembers(attendanceId: string, members: any[]): Promise<void> {
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

  async searchAttendance(params: {
    hiyawMahiderId?: string;
    memberId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<SearchAttendanceResult[]> {
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

    const attendancesCollection = collection(this.firestore, 'attendances');
    // Note: If you add order by and limit, ensure proper indexing in Firestore
    const q = query(attendancesCollection, ...conditions);
    const querySnapshot = await getDocs(q);
    const results: SearchAttendanceResult[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const convertedDate = this.convertFirestoreDate(data['date']);
    
      const attendanceData = {
        ...data,
        date: convertedDate,
        members: data['members'] || []
      } as Attendance;
    
      attendanceData.members.forEach((member) => {
        if (!params.memberId || member.userId === params.memberId) {
          results.push({
            id: docSnapshot.id, // The ID of the attendance document
            date: convertedDate,
            hiyawMahiderName: attendanceData.hiyawMahiderName,
            memberId: member.userId, // Added memberId for targeting specific member
            memberName: member.fullName,
            status: member.status,
            hiyawMahiderId: attendanceData.hiyawMahiderId,
            members: attendanceData.members,
            reason: member.reason || '-'
          });
        }
      });
    });
    
    // Sort results by date in descending order
    results.sort((a, b) => b.date.getTime() - a.date.getTime());
    return results;
  }

  async updateMemberAttendanceStatus(
    attendanceDocId: string,
    userId: string,
    newStatus: string,
    newReason: string
  ): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
    const docSnap = await getDocs(query(collection(this.firestore, 'attendances'), where('__name__', '==', attendanceDocId)));

    if (!docSnap.empty) {
      const attendanceData = docSnap.docs[0].data() as Attendance;
      const members = attendanceData.members || [];
      const memberIndex = members.findIndex(m => m.userId === userId);

      if (memberIndex > -1) {
        members[memberIndex].status = newStatus;
        members[memberIndex].reason = newReason;
        await updateDoc(attendanceRef, { members: members, updatedAt: new Date() });
      } else {
        throw new Error('Member not found in this attendance record for the specified day.');
      }
    } else {
      throw new Error('Attendance document not found.');
    }
  }

  async deleteMemberAttendanceRecord(attendanceDocId: string, userId: string): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
    const docSnap = await getDocs(query(collection(this.firestore, 'attendances'), where('__name__', '==', attendanceDocId)));

    if (!docSnap.empty) {
      const attendanceData = docSnap.docs[0].data() as Attendance;
      let members = attendanceData.members || [];
      
      const initialLength = members.length;
      members = members.filter(m => m.userId !== userId);

      if (members.length < initialLength) {
        if (members.length === 0) {
          // If no members left, delete the entire attendance document
          await this.deleteAttendanceDocument(attendanceDocId);
        } else {
          await updateDoc(attendanceRef, { members: members, updatedAt: new Date() });
        }
      } else {
        throw new Error('Member not found in this attendance record.');
      }
    } else {
      throw new Error('Attendance document not found.');
    }
  }

  async deleteAttendanceDocument(attendanceId: string): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceId);
    const batch = writeBatch(this.firestore);
    batch.delete(attendanceRef);
    await batch.commit();
  }


  async setSpecialStudyDay(hiyawMahiderId: string, date: Date, studyDay: string, reason: string): Promise<void> {
    const studyDayRef = doc(this.firestore, 'hiyawMahiderStudyDays', hiyawMahiderId);
    const currentSettings = await getDocs(query(
      collection(this.firestore, 'hiyawMahiderStudyDays'), 
      where('hiyawMahiderId', '==', hiyawMahiderId)
    ));
    
    if (currentSettings.empty) {
      await setDoc(studyDayRef, {
        hiyawMahiderId,
        defaultDay: 'Monday',
        specialDays: [{ date, studyDay, reason }]
      });
    } else {
      const existingData = currentSettings.docs[0].data() as HiyawMahiderStudyDay;
      await updateDoc(studyDayRef, { 
        specialDays: [
          ...(existingData.specialDays || []),
          { date, studyDay, reason }
        ] 
      });
    }
  }

  async addMembersToAttendance(attendanceDocId: string, newMembers: any[]): Promise<void> {
    const attendanceRef = doc(this.firestore, 'attendances', attendanceDocId);
  
    // Fetch the existing attendance document
    const docSnap = await getDocs(query(collection(this.firestore, 'attendances'), where('__name__', '==', attendanceDocId)));
  
    if (!docSnap.empty) {
      const attendanceData = docSnap.docs[0].data() as Attendance;
      const existingMembers = attendanceData.members || [];
  
      // Add the new members to the existing members array
      const updatedMembers = [...existingMembers, ...newMembers];
  
      // Update the attendance document with the new members
      await updateDoc(attendanceRef, { members: updatedMembers, updatedAt: new Date() });
    } else {
      throw new Error('Attendance document not found.');
    }
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
  
    const attendancesCollection = collection(this.firestore, 'attendances');
    const q = query(
      attendancesCollection,
      where('members', 'array-contains', { userId: memberId }),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );
  
    const querySnapshot = await getDocs(q);
    const results: SearchAttendanceResult[] = [];
  
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const convertedDate = this.convertFirestoreDate(data['date']);
  
      const attendanceData = {
        ...data,
        date: convertedDate,
        members: data['members'] || []
      } as Attendance;
  
      attendanceData.members.forEach((member) => {
        if (member.userId === memberId) {
          results.push({
            id: docSnapshot.id,
            date: convertedDate,
            hiyawMahiderName: attendanceData.hiyawMahiderName,
            memberId: member.userId,
            memberName: member.fullName,
            status: member.status,
            hiyawMahiderId: attendanceData.hiyawMahiderId,
            members: attendanceData.members,
            reason: member.reason || '-'
          });
        }
      });
    });
  
    return results;
  }


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
  members: any[]; 
};