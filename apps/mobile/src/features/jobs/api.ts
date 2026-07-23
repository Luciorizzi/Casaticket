import type { Job, JobPayment, JobQuote, JobReview } from '@casaticket/types';
import {
  completeJobByProfessionalSchema,
  createJobQuoteSchema,
  createReviewSchema,
  disputeJobCompletionSchema,
  proposeJobVisitSchema,
  recordJobDiagnosisSchema,
  rejectJobQuoteSchema,
  type CompleteJobByProfessionalInput,
  type CreateJobQuoteInput,
  type CreateReviewInput,
  type DisputeJobCompletionInput,
  type ProposeJobVisitInput,
  type RecordJobDiagnosisInput,
  type RejectJobQuoteInput,
} from '@casaticket/validation';

import { getSupabaseErrorMetadata } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

interface JobRow {
  job_id?: string;
  id?: string;
  request_id: string;
  selected_application_id: string;
  customer_id: string;
  professional_id: string;
  status: Job['status'];
  scheduled_date: string | null;
  scheduled_time_text: string | null;
  scheduling_notes: string | null;
  diagnosis_text: string | null;
  recommended_work_text?: string | null;
  materials_notes?: string | null;
  diagnosis_notes?: string | null;
  diagnosed_at: string | null;
  started_at?: string | null;
  completion_summary?: string | null;
  final_notes?: string | null;
  final_materials_notes?: string | null;
  final_materials_amount?: number | string | null;
  professional_completed_at?: string | null;
  customer_confirmed_at?: string | null;
  dispute_reason?: string | null;
  dispute_details?: string | null;
  disputed_at?: string | null;
  review_deadline_at?: string | null;
  completion_mode?: Job['completionMode'];
  created_at: string;
  updated_at: string;
}

interface JobPaymentRow {
  payment_id?: string;
  id?: string;
  job_id: string;
  quote_id: string;
  customer_id: string;
  professional_id: string;
  status: JobPayment['status'];
  provider: string;
  provider_payment_id: string | null;
  currency: string;
  labor_amount: number | string;
  visit_amount: number | string;
  materials_reference_amount: number | string;
  platform_fee_amount: number | string;
  customer_total_amount: number | string;
  professional_amount: number | string;
  released_amount: number | string | null;
  failure_reason: string | null;
  paid_at: string | null;
  secured_at: string | null;
  release_pending_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface JobQuoteRow {
  quote_id?: string;
  id?: string;
  job_id: string;
  version: number;
  labor_amount: number | string;
  materials_amount: number | string;
  visit_amount: number | string;
  platform_fee_amount: number | string;
  total_amount: number | string;
  currency: string;
  description: string;
  estimated_duration_text: string | null;
  valid_until: string | null;
  status: JobQuote['status'];
  rejection_reason?: string | null;
  rejected_reason?: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
}

interface JobReviewRow {
  id: string;
  job_id: string;
  reviewer_user_id: string;
  reviewed_user_id: string;
  reviewer_role: JobReview['reviewerRole'];
  rating: number;
  comment: string | null;
  created_at: string;
}

export const professionalJobQueryKey = (jobId: string) => ['professional-job', jobId] as const;
export const customerJobByIdQueryKey = (jobId: string) => ['customer-job-by-id', jobId] as const;
export const customerJobQueryKey = (requestId: string) => ['customer-job', requestId] as const;
export const jobPaymentQueryKey = (jobId: string) => ['job-payment', jobId] as const;
export const jobQuotesQueryKey = (jobId: string) => ['job-quotes', jobId] as const;
export const jobReviewsQueryKey = (jobId: string) => ['job-reviews', jobId] as const;

function mapMoney(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function mapJob(row: JobRow): Job {
  return {
    id: row.job_id ?? row.id ?? '',
    requestId: row.request_id,
    selectedApplicationId: row.selected_application_id,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTimeText: row.scheduled_time_text,
    schedulingNotes: row.scheduling_notes,
    diagnosisText: row.diagnosis_text,
    recommendedWorkText: row.recommended_work_text ?? null,
    materialsNotes: row.materials_notes ?? null,
    diagnosisNotes: row.diagnosis_notes ?? null,
    diagnosedAt: row.diagnosed_at,
    startedAt: row.started_at ?? null,
    completionSummary: row.completion_summary ?? null,
    finalNotes: row.final_notes ?? null,
    finalMaterialsNotes: row.final_materials_notes ?? null,
    finalMaterialsAmount:
      typeof row.final_materials_amount === 'undefined' || row.final_materials_amount === null
        ? null
        : mapMoney(row.final_materials_amount),
    professionalCompletedAt: row.professional_completed_at ?? null,
    customerConfirmedAt: row.customer_confirmed_at ?? null,
    disputeReason: row.dispute_reason ?? null,
    disputeDetails: row.dispute_details ?? null,
    disputedAt: row.disputed_at ?? null,
    reviewDeadlineAt: row.review_deadline_at ?? null,
    completionMode: row.completion_mode ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: JobPaymentRow): JobPayment {
  return {
    id: row.payment_id ?? row.id ?? '',
    jobId: row.job_id,
    quoteId: row.quote_id,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    currency: row.currency,
    laborAmount: mapMoney(row.labor_amount),
    visitAmount: mapMoney(row.visit_amount),
    materialsReferenceAmount: mapMoney(row.materials_reference_amount),
    platformFeeAmount: mapMoney(row.platform_fee_amount),
    customerTotalAmount: mapMoney(row.customer_total_amount),
    professionalAmount: mapMoney(row.professional_amount),
    releasedAmount: row.released_amount === null ? null : mapMoney(row.released_amount),
    failureReason: row.failure_reason,
    paidAt: row.paid_at,
    securedAt: row.secured_at,
    releasePendingAt: row.release_pending_at,
    releasedAt: row.released_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuote(row: JobQuoteRow): JobQuote {
  return {
    id: row.quote_id ?? row.id ?? '',
    jobId: row.job_id,
    version: row.version,
    laborAmount: mapMoney(row.labor_amount),
    materialsAmount: mapMoney(row.materials_amount),
    visitAmount: mapMoney(row.visit_amount),
    platformFeeAmount: mapMoney(row.platform_fee_amount),
    totalAmount: mapMoney(row.total_amount),
    currency: row.currency,
    description: row.description,
    estimatedDurationText: row.estimated_duration_text,
    validUntil: row.valid_until,
    status: row.status,
    rejectedReason: row.rejection_reason ?? row.rejected_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
  };
}

function mapReview(row: JobReviewRow): JobReview {
  return {
    id: row.id,
    jobId: row.job_id,
    reviewerUserId: row.reviewer_user_id,
    reviewedUserId: row.reviewed_user_id,
    reviewerRole: row.reviewer_role,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

function firstRow<T>(data: unknown): T | null {
  const rows = (data ?? []) as T[];
  return rows[0] ?? null;
}

function logDevelopmentJobError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const supabaseError = getSupabaseErrorMetadata(error);

  console.error(`[${context}] Supabase error`, {
    ...metadata,
    code: supabaseError.code ?? null,
    message: supabaseError.message ?? null,
    details: supabaseError.details ?? null,
    hint: supabaseError.hint ?? null,
  });
}

export async function getProfessionalJobById(jobId: string): Promise<Job> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();

  if (error) {
    logDevelopmentJobError('professional-job:get-by-id', error, { jobId });
    throw error;
  }

  return mapJob(data as JobRow);
}

export async function getCustomerJobById(jobId: string): Promise<Job> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();

  if (error) {
    logDevelopmentJobError('customer-job:get-by-id', error, { jobId });
    throw error;
  }

  return mapJob(data as JobRow);
}

export async function getCustomerJobByRequest(requestId: string): Promise<Job | null> {
  const { data, error } = await supabase.rpc('get_job_by_request', {
    p_request_id: requestId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:get-by-request', error, { requestId });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  return row ? mapJob(row) : null;
}

export async function listJobQuotes(jobId: string): Promise<JobQuote[]> {
  const { data, error } = await supabase.rpc('list_job_quotes', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('jobs:list-quotes', error, { jobId });
    throw error;
  }

  return ((data ?? []) as JobQuoteRow[]).map((row) => mapQuote(row));
}

export async function getJobPayment(jobId: string): Promise<JobPayment | null> {
  const { data, error } = await supabase.rpc('get_job_payment', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('jobs:get-payment', error, { jobId });
    throw error;
  }

  const row = firstRow<JobPaymentRow>(data);
  return row ? mapPayment(row) : null;
}

export async function getPaymentStatus(paymentId: string): Promise<JobPayment> {
  const { data, error } = await supabase.rpc('get_payment_status', {
    p_payment_id: paymentId,
  });

  if (error) {
    logDevelopmentJobError('jobs:get-payment-status', error, { paymentId });
    throw error;
  }

  const row = firstRow<JobPaymentRow>(data);
  if (!row) {
    throw new Error('No pudimos cargar el pago.');
  }

  return mapPayment(row);
}

export async function listJobReviews(jobId: string): Promise<JobReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    logDevelopmentJobError('jobs:list-reviews', error, { jobId });
    throw error;
  }

  return ((data ?? []) as JobReviewRow[]).map((row) => mapReview(row));
}

export async function proposeProfessionalJobVisit(
  jobId: string,
  input: ProposeJobVisitInput,
): Promise<Job> {
  const parsed = proposeJobVisitSchema.parse(input);
  const { data, error } = await supabase.rpc('propose_job_visit', {
    p_job_id: jobId,
    p_scheduled_date: parsed.scheduledDate,
    p_scheduled_time_text: parsed.scheduledTimeText,
    p_scheduling_notes: parsed.schedulingNotes,
  });

  if (error) {
    logDevelopmentJobError('professional-job:propose-visit', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos proponer la visita.');
  }

  return mapJob(row);
}

export async function confirmCustomerJobVisit(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('confirm_job_visit', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:confirm-visit', error, { jobId });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos confirmar la visita.');
  }

  return mapJob(row);
}

export async function rejectCustomerJobVisit(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('reject_job_visit', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:reject-visit', error, { jobId });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos rechazar la propuesta de visita.');
  }

  return mapJob(row);
}

export async function recordProfessionalJobDiagnosis(
  jobId: string,
  input: RecordJobDiagnosisInput,
): Promise<Job> {
  const parsed = recordJobDiagnosisSchema.parse(input);
  const { data, error } = await supabase.rpc('record_job_diagnosis', {
    p_job_id: jobId,
    p_diagnosis_text: parsed.diagnosisText,
    p_recommended_work_text: parsed.recommendedWorkText ?? null,
    p_materials_notes: parsed.materialsNotes ?? null,
    p_diagnosis_notes: parsed.diagnosisNotes ?? null,
  });

  if (error) {
    logDevelopmentJobError('professional-job:record-diagnosis', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos guardar el diagnostico.');
  }

  return mapJob(row);
}

export async function createProfessionalJobQuote(
  jobId: string,
  input: CreateJobQuoteInput,
): Promise<JobQuote> {
  const parsed = createJobQuoteSchema.parse(input);
  const { data, error } = await supabase.rpc('create_job_quote', {
    p_job_id: jobId,
    p_labor_amount: parsed.laborAmount,
    p_materials_amount: parsed.materialsAmount,
    p_visit_amount: parsed.visitAmount,
    p_description: parsed.description,
    p_estimated_duration_text: parsed.estimatedDurationText,
    p_valid_until: parsed.validUntil,
  });

  if (error) {
    logDevelopmentJobError('professional-job:create-quote', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobQuoteRow>(data);
  if (!row) {
    throw new Error('No pudimos crear el presupuesto.');
  }

  return mapQuote(row);
}

export async function sendProfessionalJobQuote(quoteId: string): Promise<JobQuote> {
  const { data, error } = await supabase.rpc('send_job_quote', {
    p_quote_id: quoteId,
  });

  if (error) {
    logDevelopmentJobError('professional-job:send-quote', error, { quoteId });
    throw error;
  }

  const row = firstRow<JobQuoteRow>(data);
  if (!row) {
    throw new Error('No pudimos enviar el presupuesto.');
  }

  return mapQuote(row);
}

export async function acceptCustomerJobQuote(
  quoteId: string,
): Promise<{ jobId: string; jobStatus: Job['status']; payment: JobPayment }> {
  const { data, error } = await supabase.rpc('accept_quote_and_create_payment', {
    p_quote_id: quoteId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:accept-quote', error, { quoteId });
    throw error;
  }

  const row = firstRow<{
    job_id: string;
    job_status: Job['status'];
    payment_id: string;
    payment_status: JobPayment['status'];
  }>(data);
  if (!row) {
    throw new Error('No pudimos aceptar el presupuesto.');
  }

  const payment = await getPaymentStatus(row.payment_id);

  return { jobId: row.job_id, jobStatus: row.job_status, payment };
}

export async function retryMockPayment(paymentId: string): Promise<JobPayment> {
  const { data, error } = await supabase.rpc('retry_mock_payment', {
    p_payment_id: paymentId,
  });

  if (error) {
    logDevelopmentJobError('jobs:retry-payment', error, { paymentId });
    throw error;
  }

  const row = firstRow<JobPaymentRow>(data);
  if (!row) {
    throw new Error('No pudimos reintentar el pago.');
  }

  return mapPayment(row);
}

export async function secureMockPayment(
  paymentId: string,
  input: { approved: boolean; failureReason?: string | null } = { approved: true },
): Promise<JobPayment> {
  const { data, error } = await supabase.rpc('secure_mock_payment', {
    p_payment_id: paymentId,
    p_approved: input.approved,
    p_failure_reason: input.failureReason ?? null,
  });

  if (error) {
    logDevelopmentJobError('jobs:secure-payment', error, { paymentId, payload: input });
    throw error;
  }

  const row = firstRow<JobPaymentRow>(data);
  if (!row) {
    throw new Error('No pudimos procesar el pago.');
  }

  return mapPayment(row);
}

export async function releaseMockPayments(): Promise<JobPayment[]> {
  const { data, error } = await supabase.rpc('release_eligible_payments');

  if (error) {
    logDevelopmentJobError('jobs:release-payments', error);
    throw error;
  }

  return ((data ?? []) as JobPaymentRow[]).map((row) => mapPayment(row));
}

export interface PaymentProvider {
  createPayment: (quoteId: string) => Promise<{ jobId: string; jobStatus: Job['status']; payment: JobPayment }>;
  processPayment: (
    paymentId: string,
    input?: { approved?: boolean; failureReason?: string | null },
  ) => Promise<JobPayment>;
  getPaymentStatus: (paymentId: string) => Promise<JobPayment>;
  releasePayment: () => Promise<JobPayment[]>;
  refundPayment: (paymentId: string) => Promise<JobPayment>;
}

export const mockPaymentProvider: PaymentProvider = {
  createPayment: acceptCustomerJobQuote,
  getPaymentStatus,
  processPayment: (paymentId, input = {}) =>
    secureMockPayment(paymentId, {
      approved: input.approved ?? true,
      failureReason: input.failureReason ?? null,
    }),
  refundPayment: async (paymentId) => {
    const { data, error } = await supabase.rpc('refund_mock_payment', {
      p_payment_id: paymentId,
    });

    if (error) {
      logDevelopmentJobError('jobs:refund-payment', error, { paymentId });
      throw error;
    }

    const row = firstRow<JobPaymentRow>(data);
    if (!row) {
      throw new Error('No pudimos devolver el pago.');
    }

    return mapPayment(row);
  },
  releasePayment: releaseMockPayments,
};

export async function rejectCustomerJobQuote(
  quoteId: string,
  input: RejectJobQuoteInput = { rejectedReason: null },
): Promise<{ jobId: string; jobStatus: Job['status'] }> {
  const parsed = rejectJobQuoteSchema.parse(input);
  const { data, error } = await supabase.rpc('reject_job_quote', {
    p_quote_id: quoteId,
    p_rejected_reason: parsed.rejectedReason,
  });

  if (error) {
    logDevelopmentJobError('customer-job:reject-quote', error, { quoteId, payload: parsed });
    throw error;
  }

  const row = firstRow<{ job_id: string; job_status: Job['status'] }>(data);
  if (!row) {
    throw new Error('No pudimos rechazar el presupuesto.');
  }

  return { jobId: row.job_id, jobStatus: row.job_status };
}

export async function startProfessionalJob(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('start_job', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('professional-job:start', error, { jobId });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos iniciar el trabajo.');
  }

  return mapJob(row);
}

export async function completeProfessionalJob(
  jobId: string,
  input: CompleteJobByProfessionalInput,
): Promise<Job> {
  const parsed = completeJobByProfessionalSchema.parse(input);
  const { data, error } = await supabase.rpc('mark_job_completed_by_professional', {
    p_job_id: jobId,
    p_completion_summary: parsed.completionSummary,
    p_final_notes: parsed.finalNotes ?? null,
    p_final_materials_notes: parsed.finalMaterialsNotes ?? null,
    p_final_materials_amount: parsed.finalMaterialsAmount ?? null,
  });

  if (error) {
    logDevelopmentJobError('professional-job:complete', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos marcar el trabajo como terminado.');
  }

  return mapJob(row);
}

export async function confirmCustomerJobCompletion(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('confirm_job_completion', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:confirm-completion', error, { jobId });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos confirmar el trabajo.');
  }

  return mapJob(row);
}

export async function disputeCustomerJobCompletion(
  jobId: string,
  input: DisputeJobCompletionInput,
): Promise<Job> {
  const parsed = disputeJobCompletionSchema.parse(input);
  const { data, error } = await supabase.rpc('dispute_job_completion', {
    p_job_id: jobId,
    p_dispute_reason: parsed.disputeReason,
    p_dispute_details: parsed.disputeDetails,
  });

  if (error) {
    logDevelopmentJobError('customer-job:dispute-completion', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos reportar el problema.');
  }

  return mapJob(row);
}

export async function createJobReview(jobId: string, input: CreateReviewInput): Promise<JobReview> {
  const parsed = createReviewSchema.parse(input);
  const { data, error } = await supabase.rpc('create_review', {
    p_job_id: jobId,
    p_rating: parsed.rating,
    p_comment: parsed.comment ?? null,
  });

  if (error) {
    logDevelopmentJobError('jobs:create-review', error, { jobId, payload: parsed });
    throw error;
  }

  const row = firstRow<JobReviewRow>(data);
  if (!row) {
    throw new Error('No pudimos guardar la calificación.');
  }

  return mapReview(row);
}
