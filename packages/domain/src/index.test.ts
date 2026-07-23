import { describe, expect, it } from 'vitest';

import {
  canSelfAssignRole,
  getApplicationProposalTypeLabel,
  getApplicationStatusLabel,
  getAvailabilityLabel,
  getConversationStatusLabel,
  getPaymentStatusLabel,
  getProfileDisplayName,
  getServiceRequestStatusLabel,
  getServiceRequestTypeLabel,
  getServiceRequestUrgencyLabel,
  getCoverageSummary,
  hasPotentialContactInfo,
  isAvailabilityStatus,
  isSelectableMobileRole,
  isServiceRadiusValid,
} from './index';

describe('domain guards', () => {
  it('rejects admin roles for self assignment', () => {
    expect(canSelfAssignRole('customer')).toBe(true);
    expect(canSelfAssignRole('admin')).toBe(false);
  });

  it('validates selectable mobile roles', () => {
    expect(isSelectableMobileRole('professional')).toBe(true);
    expect(isSelectableMobileRole('operator')).toBe(false);
  });

  it('validates supported professional availability states', () => {
    expect(isAvailabilityStatus('scheduled_only')).toBe(true);
    expect(isAvailabilityStatus('archived')).toBe(false);
  });

  it('enforces the service radius limits', () => {
    expect(isServiceRadiusValid(1)).toBe(true);
    expect(isServiceRadiusValid(100)).toBe(true);
    expect(isServiceRadiusValid(101)).toBe(false);
  });

  it('formats a readable coverage summary', () => {
    expect(getCoverageSummary('CABA', 25)).toBe('CABA hasta 25 km');
  });

  it('returns readable availability labels in Spanish', () => {
    expect(getAvailabilityLabel('available')).toBe('Disponible');
    expect(getAvailabilityLabel('scheduled_only')).toBe('Solo trabajos programados');
  });

  it('formats the display name from profile data', () => {
    expect(getProfileDisplayName({ firstName: 'Camila', lastName: 'Prueba' })).toBe('Camila Prueba');
  });

  it('returns readable service request labels in Spanish', () => {
    expect(getServiceRequestTypeLabel('diagnostic_visit')).toBe('Necesito visita diagnóstica');
    expect(getServiceRequestUrgencyLabel('urgent')).toBe('Urgente');
    expect(getServiceRequestStatusLabel('professional_selected')).toBe('Profesional seleccionado');
  });

  it('returns readable application labels in Spanish', () => {
    expect(getApplicationProposalTypeLabel('preliminary_quote')).toBe('Cotización preliminar');
    expect(getApplicationStatusLabel('withdrawn')).toBe('Retirada');
  });
  it('labels conversations and detects contact-like content', () => {
    expect(getConversationStatusLabel('read_only')).toBe('Solo lectura');
    expect(hasPotentialContactInfo('Escribime a demo@casaticket.local')).toBe(true);
    expect(hasPotentialContactInfo('Mi telefono es 1122334455')).toBe(true);
    expect(hasPotentialContactInfo('Coordinemos por este chat')).toBe(false);
  });

  it('returns readable protected payment labels', () => {
    expect(getPaymentStatusLabel('pending')).toBe('Pendiente de pago');
    expect(getPaymentStatusLabel('secured')).toBe('Pago protegido');
    expect(getPaymentStatusLabel('release_pending')).toBe('Pendiente de liberacion');
    expect(getPaymentStatusLabel('released')).toBe('Pago liberado');
    expect(getPaymentStatusLabel('refunded')).toBe('Devuelto');
  });
});
