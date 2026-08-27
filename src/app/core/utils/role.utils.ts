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
    'admin-logs',
    'members',
    'events'
  ],
  'Pastor': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance',
    'members',
    'reports',
    'events'
  ],
  'Deputy Pastor': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance',
    'members',
    'reports',
    'events'
  ],
  'Zone Coordinator': [
    'hiyaw-mahider',
    'tasks',
    'study-materials',
    'attendance',
    'zone',
    'members',
    'events'
  ],
  'Member': [
    'members',
    'study-materials',
    'tasks',
    'events'
  ]
};

export function hasPermission(role: AppRole | string | undefined | null, permission: string): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as AppRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}
