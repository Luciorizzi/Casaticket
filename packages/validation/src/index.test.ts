import { describe, expect, it } from 'vitest';

import {
  customerOnboardingSchema,
  professionalOnboardingSchema,
  roleSelectionSchema,
  signUpSchema,
} from './index';

describe('validation schemas', () => {
  it('accepts mobile roles and rejects administrative ones', () => {
    expect(roleSelectionSchema.safeParse({ role: 'customer' }).success).toBe(true);
    expect(roleSelectionSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });

  it('rejects invalid registration data', () => {
    expect(
      signUpSchema.safeParse({
        email: 'correo-invalido',
        password: '12345678',
        confirmPassword: '12345678',
        acceptTerms: true,
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        email: 'demo@casaticket.local',
        password: '1234567',
        confirmPassword: '1234567',
        acceptTerms: true,
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        email: 'demo@casaticket.local',
        password: '12345678',
        confirmPassword: '87654321',
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it('requires mandatory customer onboarding fields', () => {
    expect(
      customerOnboardingSchema.safeParse({
        firstName: '',
        lastName: '',
        phone: '',
        province: '',
        city: '',
      }).success,
    ).toBe(false);
  });

  it('enforces the professional onboarding rules', () => {
    const validPayload = {
      firstName: 'Joaquin',
      lastName: 'Demo',
      phone: '1122334455',
      province: 'Buenos Aires',
      city: 'Avellaneda',
      bio: 'Electricista matriculado con experiencia en instalaciones, tableros y mantenimiento.',
      yearsExperience: 5,
      baseCity: 'Avellaneda',
      serviceRadiusKm: 100,
      availabilityStatus: 'available' as const,
      categoryIds: ['550e8400-e29b-41d4-a716-446655440000'],
    };

    expect(professionalOnboardingSchema.safeParse(validPayload).success).toBe(true);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        serviceRadiusKm: 100,
      }).success,
    ).toBe(true);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        categoryIds: [],
      }).success,
    ).toBe(false);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        serviceRadiusKm: 0,
      }).success,
    ).toBe(false);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        serviceRadiusKm: 120,
      }).success,
    ).toBe(false);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        yearsExperience: -1,
      }).success,
    ).toBe(false);

    expect(
      professionalOnboardingSchema.safeParse({
        ...validPayload,
        bio: 'Muy corta.',
      }).success,
    ).toBe(false);
  });
});
