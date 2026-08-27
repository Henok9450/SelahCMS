export type AuditCategory =
  | 'Auth'
  | 'Member'
  | 'Attendance'
  | 'Study Material'
  | 'Hiyaw Mahider'
  | 'Pastor'
  | 'Zone'
  | 'Task';

export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_TIMEOUT'
  | 'MEMBER_CREATED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_DELETED'
  | 'ROLE_CHANGED'
  | 'ATTENDANCE_CREATED'
  | 'ATTENDANCE_UPDATED'
  | 'ATTENDANCE_DELETED'
  | 'STUDY_MATERIAL_UPLOADED'
  | 'STUDY_MATERIAL_DELETED'
  | 'HIYAW_MAHIDER_CREATED'
  | 'HIYAW_MAHIDER_UPDATED'
  | 'HIYAW_MAHIDER_DELETED'
  | 'PASTOR_CREATED'
  | 'PASTOR_UPDATED'
  | 'PASTOR_DELETED'
  | 'ZONE_CREATED'
  | 'ZONE_UPDATED'
  | 'ZONE_DELETED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED';

export interface AuditLog {
  id?: string;
  timestamp: any; // Firestore Timestamp or Date
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  category: AuditCategory;
  targetId?: string;
  targetName?: string;
  details?: Record<string, any>;
}
