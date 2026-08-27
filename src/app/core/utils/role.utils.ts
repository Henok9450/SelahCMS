import { User } from '../models/user.model';

export type AppRole = User['role'];

export const ROLES = {
  ADMIN: 'Admin' as AppRole,
  PASTOR: 'Pastor' as AppRole,
  DEPUTY_PASTOR: 'Deputy Pastor' as AppRole,
  ZONE_COORDINATOR: 'Zone Coordinator' as AppRole,
  MEMBER: 'Member' as AppRole
};

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  'Admin': [
    'hiyaw-mahider',
    'pastors',
    'reports',
    'study-materials',
    'tasks',
    'zone',
    'attendance',
    'admin-logs'
  ],
  'Pastor': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance'
  ],
  'Deputy Pastor': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance'
  ],
  'Zone Coordinator': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance',
    'zone'
  ],
  'Member': [
    'members',
    'study-materials',
    'tasks'
  ]
};
