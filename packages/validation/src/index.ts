import { COVERAGE_LIMITS, MOBILE_SELECTABLE_ROLES } from '@casaticket/domain';
import { z } from 'zod';

export const roleSelectionSchema = z.object({
  role: z.enum(MOBILE_SELECTABLE_ROLES),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(32).nullable(),
  province: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
});

export const professionalProfileSchema = z.object({
  bio: z.string().trim().max(600).nullable(),
  yearsExperience: z.number().int().min(0).max(80).nullable(),
  baseCity: z.string().trim().min(2).max(80),
  serviceRadiusKm: z.number().int().min(COVERAGE_LIMITS.minRadiusKm).max(COVERAGE_LIMITS.maxRadiusKm),
});

export const customerAddressSchema = z.object({
  label: z.string().trim().min(2).max(80),
  addressLine: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(20).nullable(),
});

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;

