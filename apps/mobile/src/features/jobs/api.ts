import type { Job, JobQuote } from '@casaticket/types';
import {
  createJobQuoteSchema,
  proposeJobVisitSchema,
  recordJobDiagnosisSchema,
  rejectJobQuoteSchema,
  type CreateJobQuoteInput,
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

export const professionalJobQueryKey = (jobId: string) => ['professional-job', jobId] as const;
export const customerJobByIdQueryKey = (jobId: string) => ['customer-job-by-id', jobId] as const;
export const customerJobQueryKey = (requestId: string) => ['customer-job', requestId] as const;
export const jobQuotesQueryKey = (jobId: string) => ['job-quotes', jobId] as const;

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

export async function acceptCustomerJobQuote(quoteId: string): Promise<{ jobId: string; jobStatus: Job['status'] }> {
  const { data, error } = await supabase.rpc('accept_job_quote', {
    p_quote_id: quoteId,
  });

  if (error) {
    logDevelopmentJobError('customer-job:accept-quote', error, { quoteId });
    throw error;
  }

  const row = firstRow<{ job_id: string; job_status: Job['status'] }>(data);
  if (!row) {
    throw new Error('No pudimos aceptar el presupuesto.');
  }

  return { jobId: row.job_id, jobStatus: row.job_status };
}

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
