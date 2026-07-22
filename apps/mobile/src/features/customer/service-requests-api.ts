import type {
  Category,
  CustomerRequestApplication,
  CustomerSelectionResult,
  ServiceRequestWithCategory,
} from '@casaticket/types';
import type { CreateServiceRequestInput } from '@casaticket/validation';

import { logDevelopmentSupabaseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceRequestRow {
  id: string;
  customer_id: string;
  category_id: string | null;
  title: string;
  description: string;
  request_type: ServiceRequestWithCategory['requestType'];
  urgency: ServiceRequestWithCategory['urgency'];
  address_text: string;
  city: string;
  province: string;
  preferred_date: string | null;
  preferred_time_text: string | null;
  availability_notes: string | null;
  status: ServiceRequestWithCategory['status'];
  selected_professional_id: string | null;
  selected_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: CategoryRow | CategoryRow[] | null;
}

interface CustomerRequestApplicationRow {
  application_id: string;
  request_id: string;
  professional_id: string;
  status: CustomerRequestApplication['status'];
  message: string;
  proposal_type: CustomerRequestApplication['proposalType'];
  visit_price: number | string | null;
  estimated_price: number | string | null;
  estimated_duration_text: string | null;
  availability_text: string;
  created_at: string;
  conversation_id: string | null;
  unread_count: number | null;
  last_message_body: string | null;
  last_message_at: string | null;
  professional_first_name: string;
  professional_last_name: string;
  professional_bio: string | null;
  professional_years_experience: number | null;
  professional_base_city: string;
  professional_service_radius_km: number;
  professional_verification_status: CustomerRequestApplication['professionalVerificationStatus'];
  professional_category_names: string[] | null;
}

interface MarkApplicationViewedRow {
  application_id: string;
  status: CustomerRequestApplication['status'];
}

interface CustomerSelectionResultRow {
  request_id: string;
  request_status: CustomerSelectionResult['requestStatus'];
  selected_professional_id: string;
  selected_application_id: string;
  selected_at: string;
  job_id: string;
}

const serviceRequestSelect = `
  *,
  category:categories (
    id,
    name,
    slug,
    description,
    active,
    created_at,
    updated_at
  )
`;

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapServiceRequest(row: ServiceRequestRow): ServiceRequestWithCategory {
  const joinedCategory = Array.isArray(row.category) ? row.category[0] : row.category;

  return {
    id: row.id,
    customerId: row.customer_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    requestType: row.request_type,
    urgency: row.urgency,
    addressText: row.address_text,
    city: row.city,
    province: row.province,
    preferredDate: row.preferred_date,
    preferredTimeText: row.preferred_time_text,
    availabilityNotes: row.availability_notes,
    status: row.status,
    selectedProfessionalId: row.selected_professional_id,
    selectedAt: row.selected_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    category: joinedCategory ? mapCategory(joinedCategory) : null,
  };
}

function mapMoney(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

function mapCustomerRequestApplication(
  row: CustomerRequestApplicationRow,
): CustomerRequestApplication {
  return {
    id: row.application_id,
    requestId: row.request_id,
    professionalId: row.professional_id,
    status: row.status,
    message: row.message,
    proposalType: row.proposal_type,
    visitPrice: mapMoney(row.visit_price),
    estimatedPrice: mapMoney(row.estimated_price),
    estimatedDurationText: row.estimated_duration_text,
    availabilityText: row.availability_text,
    createdAt: row.created_at,
    conversationId: row.conversation_id,
    unreadCount: row.unread_count ?? 0,
    lastMessageBody: row.last_message_body,
    lastMessageAt: row.last_message_at,
    professionalFirstName: row.professional_first_name,
    professionalLastName: row.professional_last_name,
    professionalBio: row.professional_bio,
    professionalYearsExperience: row.professional_years_experience,
    professionalBaseCity: row.professional_base_city,
    professionalServiceRadiusKm: row.professional_service_radius_km,
    professionalVerificationStatus: row.professional_verification_status,
    professionalCategoryNames: row.professional_category_names ?? [],
  };
}

function mapCustomerSelectionResult(row: CustomerSelectionResultRow): CustomerSelectionResult {
  return {
    requestId: row.request_id,
    requestStatus: row.request_status,
    selectedProfessionalId: row.selected_professional_id,
    selectedApplicationId: row.selected_application_id,
    selectedAt: row.selected_at,
    jobId: row.job_id,
  };
}

async function requireCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw error ?? new Error('No encontramos una sesión activa para publicar la solicitud.');
  }

  return user.id;
}

export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<ServiceRequestWithCategory> {
  const userId = await requireCurrentUserId();
  const payload = {
    customer_id: userId,
    category_id: input.unsureCategory ? null : input.categoryId,
    title: input.title,
    description: input.description,
    request_type: input.requestType,
    urgency: input.urgency,
    address_text: input.addressText,
    city: input.city,
    province: input.province,
    preferred_date: input.preferredDate,
    preferred_time_text: input.preferredTimeText,
    availability_notes: input.availabilityNotes,
    status: 'published',
    published_at: new Date().toISOString(),
  } as const;

  const { data, error } = await supabase
    .from('service_requests')
    .insert(payload)
    .select(serviceRequestSelect)
    .single();

  if (error) {
    logDevelopmentSupabaseError('service-requests:create', error);
    throw error;
  }

  return mapServiceRequest(data as ServiceRequestRow);
}

export async function listOwnServiceRequests(): Promise<ServiceRequestWithCategory[]> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(serviceRequestSelect)
    .order('created_at', { ascending: false });

  if (error) {
    logDevelopmentSupabaseError('service-requests:list-own', error);
    throw error;
  }

  return (data ?? []).map((row) => mapServiceRequest(row as ServiceRequestRow));
}

export async function getOwnServiceRequest(requestId: string): Promise<ServiceRequestWithCategory> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(serviceRequestSelect)
    .eq('id', requestId)
    .single();

  if (error) {
    logDevelopmentSupabaseError('service-requests:get-own', error);
    throw error;
  }

  return mapServiceRequest(data as ServiceRequestRow);
}

export async function cancelOwnServiceRequest(requestId: string): Promise<ServiceRequestWithCategory> {
  const { data, error } = await supabase
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'published')
    .select(serviceRequestSelect)
    .single();

  if (error) {
    logDevelopmentSupabaseError('service-requests:cancel-own', error);
    throw error;
  }

  return mapServiceRequest(data as ServiceRequestRow);
}

export async function listCustomerRequestApplications(
  requestId: string,
): Promise<CustomerRequestApplication[]> {
  const { data, error } = await supabase.rpc('list_customer_request_applications', {
    p_request_id: requestId,
  });

  if (error) {
    logDevelopmentSupabaseError('customer-applications:list', error);
    throw error;
  }

  return ((data ?? []) as CustomerRequestApplicationRow[]).map((row) =>
    mapCustomerRequestApplication(row),
  );
}

export async function markCustomerApplicationViewed(
  applicationId: string,
): Promise<MarkApplicationViewedRow> {
  const { data, error } = await supabase.rpc('mark_customer_application_viewed', {
    p_application_id: applicationId,
  });

  if (error) {
    logDevelopmentSupabaseError('customer-applications:mark-viewed', error);
    throw error;
  }

  const rows = (data ?? []) as MarkApplicationViewedRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No pudimos marcar la postulación como vista.');
  }

  return firstRow;
}

export async function selectProfessionalForRequest(
  requestId: string,
  applicationId: string,
): Promise<CustomerSelectionResult> {
  const { data, error } = await supabase.rpc('select_professional_for_request', {
    p_request_id: requestId,
    p_application_id: applicationId,
  });

  if (error) {
    logDevelopmentSupabaseError('customer-applications:select-professional', error);
    throw error;
  }

  const rows = (data ?? []) as CustomerSelectionResultRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No pudimos seleccionar este profesional.');
  }

  return mapCustomerSelectionResult(firstRow);
}
