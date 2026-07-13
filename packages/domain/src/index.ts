import type { AppRole, SelectableMobileRole } from '@casaticket/types';

export const COVERAGE_LIMITS = {
  minRadiusKm: 1,
  maxRadiusKm: 100,
} as const;

export const ADMIN_ROLES = ['admin', 'operator'] as const satisfies readonly AppRole[];

export const MOBILE_SELECTABLE_ROLES = ['customer', 'professional'] as const satisfies readonly SelectableMobileRole[];

export function isSelectableMobileRole(role: AppRole): role is SelectableMobileRole {
  return MOBILE_SELECTABLE_ROLES.includes(role as SelectableMobileRole);
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
