import type { Category, ServiceRequestWithCategory } from '@casaticket/types';
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
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: CategoryRow | CategoryRow[] | null;
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
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    category: joinedCategory ? mapCategory(joinedCategory) : null,
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
