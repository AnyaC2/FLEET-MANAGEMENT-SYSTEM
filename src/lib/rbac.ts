import type { UserRole } from '@/types';

export type CanonicalRole = 'system_admin' | 'editor' | 'end_user';
export type AppPermission = 'manage_users' | 'manage_records';

export function normalizeRole(role: UserRole): CanonicalRole {
  if (role === 'system_admin' || role === 'admin') {
    return 'system_admin';
  }

  if (
    role === 'editor' ||
    role === 'admin_officer' ||
    role === 'fleet_manager' ||
    role === 'operations_officer' ||
    role === 'maintenance_officer'
  ) {
    return 'editor';
  }

  return 'end_user';
}

export function hasPermission(role: UserRole, permission: AppPermission): boolean {
  const normalizedRole = normalizeRole(role);

  if (permission === 'manage_users') {
    return normalizedRole === 'system_admin';
  }

  if (permission === 'manage_records') {
    return normalizedRole === 'system_admin' || normalizedRole === 'editor';
  }

  return false;
}
