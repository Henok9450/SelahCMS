import { User } from './user.model';

export type AppRole = User['role'];

export const ROLES = {
  ADMIN: 'Admin' as AppRole,
  PASTOR: 'Pastor' as AppRole,
  DEPUTY_PASTOR: 'Deputy Pastor' as AppRole,
  MEMBER: 'Member' as AppRole
};

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
    'Admin': [
      'user-management',
      'hiyaw-mahider',
      'pastors',
      'reports',
      'study-materials',
      'tasks',
      'zone',
      'attendance'
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
    'Member': [
      'members',
      'study-materials',
      'tasks'
    ]
  };