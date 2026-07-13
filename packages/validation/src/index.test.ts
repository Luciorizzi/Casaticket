import { describe, expect, it } from 'vitest';

import { professionalProfileSchema, roleSelectionSchema } from './index';

describe('validation schemas', () => {
  it('accepts mobile roles and rejects administrative ones', () => {
    expect(roleSelectionSchema.safeParse({ role: 'customer' }).success).toBe(true);
    expect(roleSelectionSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });

  it('enforces the service radius boundary', () => {
    expect(
      professionalProfileSchema.safeParse({
        bio: null,
        yearsExperience: 5,
        baseCity: 'Avellaneda',
        serviceRadiusKm: 100,
      }).success,
    ).toBe(true);

    expect(
      professionalProfileSchema.safeParse({
        bio: null,
        yearsExperience: 5,
        baseCity: 'Avellaneda',
        serviceRadiusKm: 120,
      }).success,
    ).toBe(false);
  });
});

