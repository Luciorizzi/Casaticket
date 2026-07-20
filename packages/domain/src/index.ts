import type {
  AppRole,
  AvailabilityStatus,
  Profile,
  SelectableMobileRole,
  ServiceRequestStatus,
  ServiceRequestType,
  ServiceRequestUrgency,
} from '@casaticket/types';

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

export const SERVICE_REQUEST_TYPES = [
  'quote',
  'diagnostic_visit',
  'specific_task',
  'unsure',
] as const satisfies readonly ServiceRequestType[];

export const SERVICE_REQUEST_URGENCIES = [
  'flexible',
  'scheduled',
  'soon',
  'urgent',
] as const satisfies readonly ServiceRequestUrgency[];

export const SERVICE_REQUEST_STATUSES = [
  'draft',
  'published',
  'cancelled',
] as const satisfies readonly ServiceRequestStatus[];

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

export function getServiceRequestTypeLabel(type: ServiceRequestType): string {
  switch (type) {
    case 'quote':
      return 'Quiero cotizar';
    case 'diagnostic_visit':
      return 'Necesito visita diagnóstica';
    case 'specific_task':
      return 'Tarea específica';
    case 'unsure':
      return 'No estoy seguro';
  }
}

export function getServiceRequestUrgencyLabel(urgency: ServiceRequestUrgency): string {
  switch (urgency) {
    case 'flexible':
      return 'Flexible';
    case 'scheduled':
      return 'Programada';
    case 'soon':
      return 'Pronto';
    case 'urgent':
      return 'Urgente';
  }
}

export function getServiceRequestStatusLabel(status: ServiceRequestStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador';
    case 'published':
      return 'Publicada';
    case 'cancelled':
      return 'Cancelada';
  }
}

export function getProfileDisplayName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}
