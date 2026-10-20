import { Injectable, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  orderBy,
  where,
  Query,
  DocumentData,
  Timestamp
} from '@angular/fire/firestore';
import { collectionData } from 'rxfire/firestore';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { AuditLog, AuditAction, AuditCategory } from '../models/audit-log.model';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  /**
   * Records an audit log entry in Firestore. Fails silently to prevent blocking app logic.
   */
  async log(
    action: AuditAction,
    category: AuditCategory,
    targetId?: string,
    targetName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const authService = this.injector.get(AuthService);
      let user: any = null;
      try {
        user = await firstValueFrom(authService.authState$);
      } catch (_) {}

      const firebaseUser = (authService as any).auth?.currentUser;

      const actorName =
        user?.full_name ||
        user?.fullName ||
        user?.displayName ||
        user?.email ||
        firebaseUser?.displayName ||
        firebaseUser?.email ||
        (action === 'AUTH_LOGIN' && targetName ? targetName : 'Anonymous');

      const actorRole = user?.role || (action.startsWith('AUTH_') ? 'User' : 'System');
      const actorUid = user?.uid || user?.firebase_uid || user?.id || firebaseUser?.uid || 'SYSTEM';

      const auditCollection = collection(this.firestore, 'auditLogs');

      const entry: Omit<AuditLog, 'id'> = {
        timestamp: new Date(),
        actorUid,
        actorName,
        actorRole,
        action,
        category,
        ...(targetId && { targetId }),
        ...(targetName && { targetName }),
        ...(details && { details })
      };

      await addDoc(auditCollection, entry);
    } catch (err) {
      console.error('[AuditLogService] Failed to record audit log:', err);
    }
  }

  /**
   * Retrieves audit logs with optional filtering.
   */
  getLogs(filters: {
    category?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    actorSearch?: string;
  } = {}): Observable<AuditLog[]> {
    const auditCollection = collection(this.firestore, 'auditLogs');
    let q: Query<DocumentData> = query(auditCollection, orderBy('timestamp', 'desc'));

    if (filters.category) {
      q = query(q, where('category', '==', filters.category));
    }

    if (filters.action) {
      q = query(q, where('action', '==', filters.action));
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      q = query(q, where('timestamp', '>=', start));
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      q = query(q, where('timestamp', '<=', end));
    }

    return collectionData(q, { idField: 'id' }).pipe(
      map(logs =>
        logs.map(record => ({
          ...record,
          timestamp: this.formatTimestamp(record['timestamp'])
        }) as AuditLog)
      ),
      map(logs => {
        if (!filters.actorSearch) return logs;
        const term = filters.actorSearch.toLowerCase();
        return logs.filter(
          l =>
            l.actorName.toLowerCase().includes(term) ||
            l.actorRole.toLowerCase().includes(term) ||
            (l.targetName && l.targetName.toLowerCase().includes(term))
        );
      }),
      catchError(error => {
        console.error('[AuditLogService] Error fetching audit logs:', error);
        return of([]);
      })
    );
  }

  exportLogsToCSV(logs: AuditLog[], filename: string = 'audit_logs'): void {
    if (!logs || logs.length === 0) return;

    const headers = ['Timestamp', 'Actor Name', 'Actor Role', 'Category', 'Action', 'Target Name', 'Details'];
    const rows = [headers.join(',')];

    for (const l of logs) {
      const formattedDate = l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp);
      const detailsStr = l.details ? JSON.stringify(l.details).replace(/"/g, '""') : '';
      const row = [
        `"${formattedDate}"`,
        `"${(l.actorName || '').replace(/"/g, '""')}"`,
        `"${(l.actorRole || '').replace(/"/g, '""')}"`,
        `"${(l.category || '').replace(/"/g, '""')}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${(l.targetName || '').replace(/"/g, '""')}"`,
        `"${detailsStr}"`
      ];
      rows.push(row.join(','));
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private formatTimestamp(ts: any): Date {
    if (!ts) return new Date();
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
    return new Date(ts);
  }
}
