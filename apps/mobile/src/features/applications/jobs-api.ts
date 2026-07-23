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

import { logDevelopmentSupabaseError } from '@/lib/errors';
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
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
}

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
    rejectedReason: row.rejected_reason,
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

export async function getJobByRequest(requestId: string): Promise<Job | null> {
  const { data, error } = await supabase.rpc('get_job_by_request', {
    p_request_id: requestId,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:get-by-request', error);
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
    logDevelopmentSupabaseError('jobs:list-quotes', error);
    throw error;
  }

  return ((data ?? []) as JobQuoteRow[]).map((row) => mapQuote(row));
}

export async function proposeJobVisit(jobId: string, input: ProposeJobVisitInput): Promise<Job> {
  const parsed = proposeJobVisitSchema.parse(input);
  const { data, error } = await supabase.rpc('propose_job_visit', {
    p_job_id: jobId,
    p_scheduled_date: parsed.scheduledDate,
    p_scheduled_time_text: parsed.scheduledTimeText,
    p_scheduling_notes: parsed.schedulingNotes,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:propose-visit', error);
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos proponer la visita.');
  }

  return mapJob(row);
}

export async function confirmJobVisit(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('confirm_job_visit', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:confirm-visit', error);
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos confirmar la visita.');
  }

  return mapJob(row);
}

export async function rejectJobVisit(jobId: string): Promise<Job> {
  const { data, error } = await supabase.rpc('reject_job_visit', {
    p_job_id: jobId,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:reject-visit', error);
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos rechazar la propuesta de visita.');
  }

  return mapJob(row);
}

export async function recordJobDiagnosis(
  jobId: string,
  input: RecordJobDiagnosisInput,
): Promise<Job> {
  const parsed = recordJobDiagnosisSchema.parse(input);
  const { data, error } = await supabase.rpc('record_job_diagnosis', {
    p_job_id: jobId,
    p_diagnosis_text: parsed.diagnosisText,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:record-diagnosis', error);
    throw error;
  }

  const row = firstRow<JobRow>(data);
  if (!row) {
    throw new Error('No pudimos guardar el diagnostico.');
  }

  return mapJob(row);
}

export async function createJobQuote(jobId: string, input: CreateJobQuoteInput): Promise<JobQuote> {
  const parsed = createJobQuoteSchema.parse(input);
  const { data, error } = await supabase.rpc('create_job_quote', {
    p_job_id: jobId,
    p_labor_amount: parsed.laborAmount,
    p_materials_amount: parsed.materialsAmount,
    p_visit_amount: parsed.visitAmount,
    p_platform_fee_amount: parsed.platformFeeAmount,
    p_description: parsed.description,
    p_estimated_duration_text: parsed.estimatedDurationText,
    p_valid_until: parsed.validUntil,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:create-quote', error);
    throw error;
  }

  const row = firstRow<JobQuoteRow>(data);
  if (!row) {
    throw new Error('No pudimos crear el presupuesto.');
  }

  return mapQuote(row);
}

export async function sendJobQuote(quoteId: string): Promise<JobQuote> {
  const { data, error } = await supabase.rpc('send_job_quote', {
    p_quote_id: quoteId,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:send-quote', error);
    throw error;
  }

  const row = firstRow<JobQuoteRow>(data);
  if (!row) {
    throw new Error('No pudimos enviar el presupuesto.');
  }

  return mapQuote(row);
}

export async function acceptJobQuote(quoteId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_job_quote', {
    p_quote_id: quoteId,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:accept-quote', error);
    throw error;
  }
}

export async function rejectJobQuote(
  quoteId: string,
  input: RejectJobQuoteInput = { rejectedReason: null },
): Promise<void> {
  const parsed = rejectJobQuoteSchema.parse(input);
  const { error } = await supabase.rpc('reject_job_quote', {
    p_quote_id: quoteId,
    p_rejected_reason: parsed.rejectedReason,
  });

  if (error) {
    logDevelopmentSupabaseError('jobs:reject-quote', error);
    throw error;
  }
}
