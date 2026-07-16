import type { AppRole, AvailabilityStatus, Profile, SelectableMobileRole } from '@casaticket/types';

export const COVERAGE_LIMITS = {
  minRadiusKm: 1,
  maxRadiusKm: 100,
} as const;

export const ADMIN_ROLES = ['admin', 'operator'] as const satisfies readonly AppRole[];

export const MOBILE_SELECTABLE_ROLES = ['customer', 'professional'] as const satisfies readonly SelectableMobileRole[];

export const PROFESSIONAL_AVAILABILITY_STATUSES = [
  'available',
  'unavailable',
  'busy',
  'scheduled_only',
  'paused',
] as const satisfies readonly AvailabilityStatus[];

export function isSelectableMobileRole(role: AppRole): role is SelectableMobileRole {
  return MOBILE_SELECTABLE_ROLES.includes(role as SelectableMobileRole);
}

export function isAvailabilityStatus(value: string): value is AvailabilityStatus {
  return PROFESSIONAL_AVAILABILITY_STATUSES.includes(value as AvailabilityStatus);
}

export function canSelfAssignRole(role: AppRole): boolean {
  return role !== 'admin' && role !== 'operator';
}

export function isServiceRadiusValid(radiusKm: number): boolean {
  return radiusKm >= COVERAGE_LIMITS.minRadiusKm && radiusKm <= COVERAGE_LIMITS.maxRadiusKm;
}

export function getCoverageSummary(baseCity: string, radiusKm: number): string {
  return `${baseCity} hasta ${radiusKm} km`;
}

export function getAvailabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'unavailable':
      return 'No disponible';
    case 'busy':
      return 'Ocupado';
    case 'scheduled_only':
      return 'Solo trabajos programados';
    case 'paused':
      return 'Perfil pausado';
  }
}

export function getProfileDisplayName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}
