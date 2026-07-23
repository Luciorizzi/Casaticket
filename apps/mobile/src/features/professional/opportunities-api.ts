import type {
  ProfessionalApplication,
  ProfessionalOpportunity,
  ProfessionalSelectedJob,
} from '@casaticket/types';
import type { CreateApplicationInput } from '@casaticket/validation';

import { logDevelopmentSupabaseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

interface OpportunityRpcRow {
  request_id: string;
  title: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  request_type: ProfessionalOpportunity['requestType'];
  urgency: ProfessionalOpportunity['urgency'];
  city: string;
  province: string;
  preferred_date: string | null;
  preferred_time_text: string | null;
  availability_notes: string | null;
  published_at: string | null;
}

interface ApplicationRow {
  id: string;
  request_id: string;
  professional_id: string;
  message: string;
  proposal_type: ProfessionalApplication['proposalType'];
  visit_price: number | string | null;
  estimated_price: number | string | null;
  estimated_duration_text: string | null;
  availability_text: string;
  status: ProfessionalApplication['status'];
  conversation_id?: string | null;
  unread_count?: number | null;
  last_message_body?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
  withdrawn_at: string | null;
}

interface SelectedJobRpcRow {
  application_id?: string | null;
  selected_application_id?: string | null;
  jobs?: SelectedJobNestedRow | SelectedJobNestedRow[] | null;
  request_id: string;
  title: string;
  category_name: string | null;
  city: string;
  request_status: ProfessionalSelectedJob['requestStatus'];
  selected_at: string | null;
  conversation_id: string | null;
  unread_count: number | null;
  last_message_body: string | null;
  last_message_at: string | null;
  job_id?: string | null;
  job_status?: ProfessionalSelectedJob['jobStatus'];
}

interface SelectedJobNestedRow {
  id: string | null;
  status: ProfessionalSelectedJob['jobStatus'] | null;
}

interface SelectedJobLookupRow {
  id: string;
  selected_application_id: string;
  request_id: string;
  status: ProfessionalSelectedJob['jobStatus'];
}

function mapOpportunity(row: OpportunityRpcRow): ProfessionalOpportunity {
  return {
    requestId: row.request_id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    requestType: row.request_type,
    urgency: row.urgency,
    city: row.city,
    province: row.province,
    preferredDate: row.preferred_date,
    preferredTimeText: row.preferred_time_text,
    availabilityNotes: row.availability_notes,
    publishedAt: row.published_at,
  };
}

function mapMoney(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

function mapApplication(row: ApplicationRow): ProfessionalApplication {
  return {
    id: row.id,
    requestId: row.request_id,
    professionalId: row.professional_id,
    message: row.message,
    proposalType: row.proposal_type,
    visitPrice: mapMoney(row.visit_price),
    estimatedPrice: mapMoney(row.estimated_price),
    estimatedDurationText: row.estimated_duration_text,
    availabilityText: row.availability_text,
    status: row.status,
    conversationId: row.conversation_id ?? null,
    unreadCount: row.unread_count ?? 0,
    lastMessageBody: row.last_message_body ?? null,
    lastMessageAt: row.last_message_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    withdrawnAt: row.withdrawn_at,
  };
}

function mapSelectedJob(row: SelectedJobRpcRow): ProfessionalSelectedJob {
  const applicationId = row.application_id ?? row.selected_application_id ?? '';
  const rawJob = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;

  return {
    applicationId,
    requestId: row.request_id,
    title: row.title,
    categoryName: row.category_name,
    city: row.city,
    requestStatus: row.request_status,
    selectedAt: row.selected_at,
    conversationId: row.conversation_id,
    unreadCount: row.unread_count ?? 0,
    lastMessageBody: row.last_message_body,
    lastMessageAt: row.last_message_at,
    jobId: row.job_id ?? rawJob?.id ?? null,
    jobStatus: row.job_status ?? rawJob?.status ?? null,
  };
}

async function getSelectedJobLookup(applicationId: string): Promise<SelectedJobLookupRow | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, selected_application_id, request_id, status')
    .eq('selected_application_id', applicationId)
    .maybeSingle();

  if (error) {
    logDevelopmentSupabaseError('professional-jobs:lookup-selected-job', error);
    throw error;
  }

  return data as SelectedJobLookupRow | null;
}

async function hydrateSelectedJob(job: ProfessionalSelectedJob): Promise<ProfessionalSelectedJob> {
  if (job.jobId || !job.applicationId) {
    return job;
  }

  const selectedJob = await getSelectedJobLookup(job.applicationId);

  if (!selectedJob) {
    return job;
  }

  return {
    ...job,
    jobId: selectedJob.id,
    jobStatus: selectedJob.status,
    requestId: selectedJob.request_id,
  };
}

export async function listProfessionalOpportunities(
  professionalId: string,
): Promise<ProfessionalOpportunity[]> {
  const { data, error } = await supabase.rpc('list_professional_opportunities', {
    p_professional_id: professionalId,
  });

  if (error) {
    logDevelopmentSupabaseError('professional-opportunities:list', error);
    throw error;
  }

  return ((data ?? []) as OpportunityRpcRow[]).map((row) => mapOpportunity(row));
}

export async function getProfessionalOpportunity(
  requestId: string,
  professionalId: string,
): Promise<ProfessionalOpportunity> {
  const { data, error } = await supabase.rpc('get_professional_opportunity', {
    p_professional_id: professionalId,
    p_request_id: requestId,
  });

  if (error) {
    logDevelopmentSupabaseError('professional-opportunities:get', error);
    throw error;
  }

  const rows = (data ?? []) as OpportunityRpcRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No encontramos esta oportunidad disponible para tu perfil.');
  }

  return mapOpportunity(firstRow);
}

export async function listOwnApplications(professionalId: string): Promise<ProfessionalApplication[]> {
  void professionalId;

  const { data, error } = await supabase.rpc('list_professional_applications');

  if (error) {
    logDevelopmentSupabaseError('professional-applications:list-own', error);
    throw error;
  }

  return ((data ?? []) as ApplicationRow[]).map((row) => mapApplication(row));
}

export async function getOwnApplication(
  requestId: string,
  professionalId: string,
): Promise<ProfessionalApplication | null> {
  void professionalId;

  const { data, error } = await supabase.rpc('get_professional_application', {
    p_request_id: requestId,
  });

  if (error) {
    logDevelopmentSupabaseError('professional-applications:get-own', error);
    throw error;
  }

  const rows = (data ?? []) as ApplicationRow[];
  const firstRow = rows[0];

  return firstRow ? mapApplication(firstRow) : null;
}

export async function createApplication(
  professionalId: string,
  requestId: string,
  input: CreateApplicationInput,
): Promise<ProfessionalApplication> {
  const payload = {
    request_id: requestId,
    professional_id: professionalId,
    message: input.message,
    proposal_type: input.proposalType,
    visit_price: input.visitPrice,
    estimated_price: input.estimatedPrice,
    estimated_duration_text: input.estimatedDurationText,
    availability_text: input.availabilityText,
    status: 'submitted',
  } as const;
  const { data, error } = await supabase
    .from('applications')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    logDevelopmentSupabaseError('professional-applications:create', error);
    throw error;
  }

  return mapApplication(data as ApplicationRow);
}

export async function withdrawApplication(
  applicationId: string,
  professionalId: string,
): Promise<ProfessionalApplication> {
  const { data, error } = await supabase
    .from('applications')
    .update({
      status: 'withdrawn',
      withdrawn_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('professional_id', professionalId)
    .in('status', ['submitted', 'viewed'])
    .select('*')
    .single();

  if (error) {
    logDevelopmentSupabaseError('professional-applications:withdraw', error);
    throw error;
  }

  return mapApplication(data as ApplicationRow);
}

export async function listProfessionalSelectedJobs(
  professionalId: string,
): Promise<ProfessionalSelectedJob[]> {
  void professionalId;

  const { data, error } = await supabase.rpc('list_professional_selected_jobs');

  if (error) {
    logDevelopmentSupabaseError('professional-jobs:list-selected', error);
    throw error;
  }

  const selectedJobs = ((data ?? []) as SelectedJobRpcRow[]).map((row) => mapSelectedJob(row));

  return Promise.all(selectedJobs.map((job) => hydrateSelectedJob(job)));
}
