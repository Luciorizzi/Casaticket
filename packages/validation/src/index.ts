import { COVERAGE_LIMITS, MOBILE_SELECTABLE_ROLES, PROFESSIONAL_AVAILABILITY_STATUSES } from '@casaticket/domain';
import { z } from 'zod';

const requiredText = (fieldLabel: string, min = 2, max = 80) =>
  z
    .string({
      required_error: `${fieldLabel} es obligatorio.`,
      invalid_type_error: `${fieldLabel} es obligatorio.`,
    })
    .trim()
    .min(min, `${fieldLabel} es obligatorio.`)
    .max(max, `${fieldLabel} es demasiado largo.`);

export const signInSchema = z.object({
  email: z.string().trim().email('Ingresá un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

export const signUpSchema = z
  .object({
    email: z.string().trim().email('Ingresá un correo válido.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirmá tu contraseña.'),
    acceptTerms: z.boolean().refine((value) => value, 'Necesitás aceptar los términos para continuar.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Ingresá un correo válido.'),
});

export const roleSelectionSchema = z.object({
  role: z.enum(MOBILE_SELECTABLE_ROLES),
});

export const profileSchema = z.object({
  firstName: requiredText('El nombre'),
  lastName: requiredText('El apellido'),
  phone: requiredText('El teléfono', 8, 32),
  province: requiredText('La provincia'),
  city: requiredText('La ciudad'),
});

export const professionalProfileSchema = z.object({
  bio: z
    .string({
      required_error: 'La descripción profesional es obligatoria.',
      invalid_type_error: 'La descripción profesional es obligatoria.',
    })
    .trim()
    .min(40, 'La descripción profesional debe tener al menos 40 caracteres.')
    .max(600, 'La descripción profesional es demasiado larga.'),
  yearsExperience: z
    .number({
      required_error: 'Indicá tus años de experiencia.',
      invalid_type_error: 'Indicá tus años de experiencia.',
    })
    .int('Los años de experiencia deben ser un número entero.')
    .min(0, 'Los años de experiencia no pueden ser negativos.')
    .max(60, 'Los años de experiencia no pueden superar 60.'),
  baseCity: requiredText('La ciudad base'),
  serviceRadiusKm: z
    .number({
      required_error: 'Elegí un radio de trabajo.',
      invalid_type_error: 'Elegí un radio de trabajo.',
    })
    .int('El radio de trabajo debe ser un número entero.')
    .min(COVERAGE_LIMITS.minRadiusKm, 'El radio mínimo es de 1 km.')
    .max(COVERAGE_LIMITS.maxRadiusKm, 'El radio máximo es de 100 km.'),
  availabilityStatus: z.enum(PROFESSIONAL_AVAILABILITY_STATUSES, {
    errorMap: () => ({ message: 'Elegí una disponibilidad válida.' }),
  }),
  categoryIds: z.array(z.string().uuid('La categoría seleccionada no es válida.')).min(1, 'Elegí al menos una categoría.'),
});

export const customerAddressSchema = z.object({
  label: requiredText('La etiqueta', 2, 80),
  addressLine: requiredText('La dirección', 5, 200),
  city: requiredText('La ciudad'),
  province: requiredText('La provincia'),
  postalCode: z.string().trim().max(20).nullable(),
});

export const customerOnboardingSchema = profileSchema.extend({
  initialAddress: z.string().trim().max(200, 'La dirección es demasiado larga.').optional(),
});

export const professionalOnboardingSchema = profileSchema.merge(professionalProfileSchema);

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
export type CustomerOnboardingInput = z.infer<typeof customerOnboardingSchema>;
export type ProfessionalOnboardingInput = z.infer<typeof professionalOnboardingSchema>;
