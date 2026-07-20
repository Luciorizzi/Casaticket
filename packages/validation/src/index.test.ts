import { describe, expect, it } from 'vitest';

import {
  customerOnboardingSchema,
  createServiceRequestSchema,
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

  it('validates customer service request creation', () => {
    const validPayload = {
      title: 'Arreglo de pérdida',
      description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      unsureCategory: false,
      requestType: 'specific_task' as const,
      urgency: 'soon' as const,
      addressText: 'Calle 123',
      city: 'Lanus',
      province: 'Buenos Aires',
      preferredDate: undefined,
      preferredTimeText: '',
      availabilityNotes: '',
    };

    expect(createServiceRequestSchema.safeParse(validPayload).success).toBe(true);
    expect(createServiceRequestSchema.safeParse({ ...validPayload, title: 'abc' }).success).toBe(false);
    expect(createServiceRequestSchema.safeParse({ ...validPayload, categoryId: null }).success).toBe(false);
    expect(
      createServiceRequestSchema.safeParse({
        ...validPayload,
        categoryId: null,
        unsureCategory: true,
        requestType: 'unsure',
      }).success,
    ).toBe(true);
  });

  it('rejects preferred dates in the past', () => {
    expect(
      createServiceRequestSchema.safeParse({
        title: 'Arreglo de pérdida',
        description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
        categoryId: null,
        unsureCategory: true,
        requestType: 'unsure',
        urgency: 'scheduled',
        addressText: 'Calle 123',
        city: 'Lanus',
        province: 'Buenos Aires',
        preferredDate: '2020-01-01',
        preferredTimeText: '',
        availabilityNotes: '',
      }).success,
    ).toBe(false);
  });
});
