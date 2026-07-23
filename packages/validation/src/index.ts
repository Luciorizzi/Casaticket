import {
  COVERAGE_LIMITS,
  APPLICATION_PROPOSAL_TYPES,
  MOBILE_SELECTABLE_ROLES,
  PROFESSIONAL_AVAILABILITY_STATUSES,
  SERVICE_REQUEST_TYPES,
  SERVICE_REQUEST_URGENCIES,
} from '@casaticket/domain';
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

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

const optionalDateString = z.preprocess(
  (value) => value ?? '',
  z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Usá una fecha válida.')
    .refine((value) => !value || value >= todayDateString(), 'La fecha preferida no puede estar en el pasado.')
    .transform((value) => value || null),
);

const optionalShortText = (max: number, message: string) =>
  z.preprocess(
    (value) => value ?? '',
    z
      .string()
      .trim()
      .max(max, message)
      .transform((value) => value || null),
  );

export const createServiceRequestSchema = z
  .object({
    title: requiredText('El título', 5, 80),
    description: requiredText('La descripción', 20, 1500),
    categoryId: z.string().uuid('La categoría seleccionada no es válida.').nullable(),
    unsureCategory: z.boolean(),
    requestType: z.enum(SERVICE_REQUEST_TYPES, {
      errorMap: () => ({ message: 'Elegí un tipo de solicitud válido.' }),
    }),
    urgency: z.enum(SERVICE_REQUEST_URGENCIES, {
      errorMap: () => ({ message: 'Elegí una urgencia válida.' }),
    }),
    addressText: requiredText('La dirección', 5, 200),
    city: requiredText('La ciudad'),
    province: requiredText('La provincia'),
    preferredDate: optionalDateString,
    preferredTimeText: optionalShortText(120, 'El horario o disponibilidad es demasiado largo.'),
    availabilityNotes: optionalShortText(300, 'Las notas de disponibilidad son demasiado largas.'),
  })
  .refine((values) => values.unsureCategory || values.categoryId !== null, {
    message: 'Elegí una categoría o marcá que no estás seguro.',
    path: ['categoryId'],
  });

const optionalNonNegativeNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || typeof value === 'undefined') {
      return null;
    }

    return value;
  },
  z
    .number({
      invalid_type_error: 'Ingresá un precio válido.',
    })
    .min(0, 'El precio no puede ser negativo.')
    .nullable(),
);

export const createApplicationSchema = z
  .object({
    message: requiredText('El mensaje', 20, 1000),
    proposalType: z.enum(APPLICATION_PROPOSAL_TYPES, {
      errorMap: () => ({ message: 'Elegí un tipo de propuesta válido.' }),
    }),
    visitPrice: optionalNonNegativeNumber,
    estimatedPrice: optionalNonNegativeNumber,
    estimatedDurationText: optionalShortText(120, 'La duración estimada es demasiado larga.'),
    availabilityText: requiredText('La disponibilidad', 2, 300),
  })
  .superRefine((values, context) => {
    if (values.proposalType === 'diagnostic_visit' && values.visitPrice === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá el precio de la visita diagnóstica.',
        path: ['visitPrice'],
      });
    }

    if (
      (values.proposalType === 'preliminary_quote' || values.proposalType === 'direct_service') &&
      values.estimatedPrice === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá un precio estimado para esta propuesta.',
        path: ['estimatedPrice'],
      });
    }
  });

export const createMessageSchema = z.object({
  body: z
    .string({
      required_error: 'Escribí un mensaje.',
      invalid_type_error: 'Escribí un mensaje.',
    })
    .trim()
    .min(1, 'Escribí un mensaje.')
    .max(2000, 'El mensaje no puede superar 2000 caracteres.'),
});

export const proposeJobVisitSchema = z.object({
  scheduledDate: optionalDateString,
  scheduledTimeText: requiredText('El horario', 2, 120),
  schedulingNotes: optionalShortText(500, 'Las notas de coordinacion son demasiado largas.'),
});

export const recordJobDiagnosisSchema = z.object({
  diagnosisText: z
    .string({
      required_error: 'El diagnostico es obligatorio.',
      invalid_type_error: 'El diagnostico es obligatorio.',
    })
    .trim()
    .min(20, 'El diagnostico debe tener al menos 20 caracteres.')
    .max(3000, 'El diagnostico no puede superar 3000 caracteres.'),
  recommendedWorkText: z
    .string({
      invalid_type_error: 'El trabajo recomendado debe ser texto.',
    })
    .trim()
    .min(10, 'El trabajo recomendado debe tener al menos 10 caracteres.')
    .max(3000, 'El trabajo recomendado no puede superar 3000 caracteres.')
    .optional(),
  materialsNotes: optionalShortText(1000, 'Los materiales u observaciones son demasiado largos.').optional(),
  diagnosisNotes: optionalShortText(1000, 'Las notas del diagnostico son demasiado largas.').optional(),
});

const requiredNonNegativeNumber = (fieldLabel: string) =>
  z
    .number({
      required_error: `${fieldLabel} es obligatorio.`,
      invalid_type_error: `Ingresa un importe valido para ${fieldLabel.toLowerCase()}.`,
    })
    .min(0, 'El importe no puede ser negativo.');

export const createJobQuoteSchema = z
  .object({
    laborAmount: requiredNonNegativeNumber('La mano de obra'),
    materialsAmount: requiredNonNegativeNumber('Los materiales'),
    visitAmount: requiredNonNegativeNumber('La visita'),
    platformFeeAmount: requiredNonNegativeNumber('La comision de plataforma').optional(),
    description: requiredText('La descripcion del presupuesto', 20, 3000),
    estimatedDurationText: optionalShortText(120, 'La duracion estimada es demasiado larga.'),
    validUntil: optionalDateString,
  })
  .superRefine((value, ctx) => {
    const platformFeeAmount = Math.round(value.laborAmount * 0.05 * 100) / 100;
    const total = value.laborAmount + value.visitAmount + platformFeeAmount;

    if (total <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El presupuesto debe incluir al menos un importe mayor a cero.',
        path: ['laborAmount'],
      });
    }
  });

export const rejectJobQuoteSchema = z.object({
  rejectedReason: optionalShortText(500, 'El motivo de rechazo es demasiado largo.'),
});

export const completeJobByProfessionalSchema = z.object({
  completionSummary: requiredText('El resumen del trabajo realizado', 20, 3000),
  finalNotes: optionalShortText(1000, 'Las observaciones finales son demasiado largas.'),
  finalMaterialsNotes: optionalShortText(1000, 'Los materiales utilizados son demasiado largos.'),
  finalMaterialsAmount: optionalNonNegativeNumber,
});

export const disputeJobCompletionSchema = z.object({
  disputeReason: requiredText('El motivo del problema', 3, 120),
  disputeDetails: requiredText('El detalle del problema', 20, 2000),
});

export const createReviewSchema = z.object({
  rating: z
    .number({
      required_error: 'Elegí una calificación.',
      invalid_type_error: 'Elegí una calificación válida.',
    })
    .int('La calificación debe ser un número entero.')
    .min(1, 'La calificación mínima es 1.')
    .max(5, 'La calificación máxima es 5.'),
  comment: optionalShortText(1000, 'El comentario es demasiado largo.'),
});

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
export type CustomerOnboardingInput = z.infer<typeof customerOnboardingSchema>;
export type ProfessionalOnboardingInput = z.infer<typeof professionalOnboardingSchema>;
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ProposeJobVisitInput = z.infer<typeof proposeJobVisitSchema>;
export type RecordJobDiagnosisInput = z.infer<typeof recordJobDiagnosisSchema>;
export type CreateJobQuoteInput = z.infer<typeof createJobQuoteSchema>;
export type RejectJobQuoteInput = z.infer<typeof rejectJobQuoteSchema>;
export type CompleteJobByProfessionalInput = z.infer<typeof completeJobByProfessionalSchema>;
export type DisputeJobCompletionInput = z.infer<typeof disputeJobCompletionSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
