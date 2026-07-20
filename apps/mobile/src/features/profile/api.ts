import type {
  AvailabilityStatus,
  Category,
  CustomerAddress,
  ProfessionalProfile,
  Profile,
  SelectableMobileRole,
  VerificationStatus,
} from '@casaticket/types';
import type {
  CustomerOnboardingInput,
  ProfessionalOnboardingInput,
} from '@casaticket/validation';

import { getSupabaseErrorMetadata } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_path: string | null;
  role: SelectableMobileRole | null;
  province: string;
  city: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfessionalProfileRow {
  id: string;
  user_id: string;
  bio: string | null;
  years_experience: number | null;
  base_city: string;
  base_latitude: number | null;
  base_longitude: number | null;
  service_radius_km: number;
  availability_status: AvailabilityStatus;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

interface CustomerAddressRow {
  id: string;
  customer_id: string;
  label: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    avatarPath: row.avatar_path,
    role: row.role,
    province: row.province,
    city: row.city,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfessionalProfile(row: ProfessionalProfileRow): ProfessionalProfile {
  return {
    id: row.id,
    userId: row.user_id,
    bio: row.bio,
    yearsExperience: row.years_experience,
    baseCity: row.base_city,
    baseLatitude: row.base_latitude,
    baseLongitude: row.base_longitude,
    serviceRadiusKm: row.service_radius_km,
    availabilityStatus: row.availability_status,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomerAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    addressLine: row.address_line,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function logCustomerOnboardingDevelopment(
  context: string,
  payload: {
    userId: string;
    updatePayload: {
      first_name: string;
      last_name: string;
      phone: string;
      city: string;
      province: string;
      onboarding_completed: true;
    };
    error?: unknown;
  },
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const metadata = getSupabaseErrorMetadata(payload.error);

  console.info(`[${context}] customer onboarding profile update`, {
    userId: payload.userId,
    payload: payload.updatePayload,
    error: payload.error
      ? {
          code: metadata.code ?? null,
          message: metadata.message ?? null,
          details: metadata.details ?? null,
          hint: metadata.hint ?? null,
        }
      : null,
  });
}

function logProfessionalOnboardingDevelopment(
  context: string,
  payload: {
    userId: string;
    stage: string;
    operationPayload: Record<string, unknown>;
    error?: unknown;
  },
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const metadata = getSupabaseErrorMetadata(payload.error);

  console.info(`[${context}] professional onboarding`, {
    userId: payload.userId,
    stage: payload.stage,
    payload: payload.operationPayload,
    error: payload.error
      ? {
          code: metadata.code ?? null,
          message: metadata.message ?? null,
          details: metadata.details ?? null,
          hint: metadata.hint ?? null,
        }
      : null,
  });
}

async function requireCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw error ?? new Error('No encontramos una sesión activa para guardar el perfil.');
  }

  return user.id;
}

export async function fetchOwnProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function ensureOwnProfile(userId: string): Promise<Profile> {
  const existingProfile = await fetchOwnProfile();

  if (existingProfile) {
    return existingProfile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role: null,
    })
    .select('*')
    .single();

  if (error) {
    const maybeCreatedProfile = await fetchOwnProfile();
    if (maybeCreatedProfile) {
      return maybeCreatedProfile;
    }

    throw error;
  }

  return mapProfile(data as ProfileRow);
}

export async function updateOwnRole(role: SelectableMobileRole): Promise<Profile> {
  const userId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data as ProfileRow);
}

export async function fetchOwnProfessionalProfile(): Promise<ProfessionalProfile | null> {
  const { data, error } = await supabase.from('professional_profiles').select('*').maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfessionalProfile(data as ProfessionalProfileRow) : null;
}

export async function fetchOwnProfessionalCategoryIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('professional_categories')
    .select('category_id');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => String(row.category_id));
}

export async function fetchOwnDefaultAddress(): Promise<CustomerAddress | null> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCustomerAddress(data as CustomerAddressRow) : null;
}

async function upsertDefaultCustomerAddress(values: CustomerOnboardingInput): Promise<void> {
  const userId = await requireCurrentUserId();
  const addressLine = values.initialAddress?.trim();

  if (!addressLine) {
    return;
  }

  const existingAddress = await fetchOwnDefaultAddress();

  if (existingAddress) {
    const { error } = await supabase
      .from('customer_addresses')
      .update({
        label: 'Casa',
        address_line: addressLine,
        city: values.city,
        province: values.province,
        is_default: true,
      })
      .eq('id', existingAddress.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from('customer_addresses').insert({
    customer_id: userId,
    label: 'Casa',
    address_line: addressLine,
    city: values.city,
    province: values.province,
    is_default: true,
  });

  if (error) {
    throw error;
  }
}

export async function saveCustomerOnboarding(values: CustomerOnboardingInput): Promise<Profile> {
  const userId = await requireCurrentUserId();
  const updatePayload = {
    first_name: values.firstName,
    last_name: values.lastName,
    phone: values.phone,
    city: values.city,
    province: values.province,
    onboarding_completed: true,
  } as const;

  logCustomerOnboardingDevelopment('profile-api:save-customer-onboarding', {
    userId,
    updatePayload,
  });

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    logCustomerOnboardingDevelopment('profile-api:save-customer-onboarding:error', {
      userId,
      updatePayload,
      error,
    });
    throw error;
  }

  await upsertDefaultCustomerAddress(values);

  return mapProfile(data as ProfileRow);
}

export async function upsertProfessionalProfile(
  values: ProfessionalOnboardingInput,
): Promise<ProfessionalProfile> {
  const userId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from('professional_profiles')
    .upsert(
      {
        user_id: userId,
        bio: values.bio,
        years_experience: values.yearsExperience,
        base_city: values.baseCity,
        service_radius_km: values.serviceRadiusKm,
        availability_status: values.availabilityStatus,
      },
      {
        onConflict: 'user_id',
      },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProfessionalProfile(data as ProfessionalProfileRow);
}

export async function replaceProfessionalCategories(
  professionalId: string,
  categoryIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('professional_categories')
    .delete()
    .eq('professional_id', professionalId);

  if (deleteError) {
    throw deleteError;
  }

  if (categoryIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('professional_categories').insert(
    categoryIds.map((categoryId) => ({
      professional_id: professionalId,
      category_id: categoryId,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function saveProfessionalOnboarding(
  values: ProfessionalOnboardingInput,
): Promise<{ profile: Profile; professionalProfile: ProfessionalProfile; categories: string[] }> {
  const userId = await requireCurrentUserId();
  const profilePayload = {
    first_name: values.firstName,
    last_name: values.lastName,
    phone: values.phone,
    city: values.city,
    province: values.province,
  } as const;

  logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding', {
    userId,
    stage: 'profiles.update',
    operationPayload: profilePayload,
  });

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
    .select('*')
    .single();

  if (profileError) {
    logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding:error', {
      userId,
      stage: 'profiles.update',
      operationPayload: profilePayload,
      error: profileError,
    });
    throw profileError;
  }

  logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding', {
    userId,
    stage: 'professional_profiles.upsert',
    operationPayload: {
      user_id: userId,
      bio: values.bio,
      years_experience: values.yearsExperience,
      base_city: values.baseCity,
      service_radius_km: values.serviceRadiusKm,
      availability_status: values.availabilityStatus,
    },
  });

  let professionalProfile: ProfessionalProfile;

  try {
    professionalProfile = await upsertProfessionalProfile(values);
  } catch (professionalProfileError) {
    logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding:error', {
      userId,
      stage: 'professional_profiles.upsert',
      operationPayload: {
        user_id: userId,
        bio: values.bio,
        years_experience: values.yearsExperience,
        base_city: values.baseCity,
        service_radius_km: values.serviceRadiusKm,
        availability_status: values.availabilityStatus,
      },
      error: professionalProfileError,
    });
    throw professionalProfileError;
  }

  logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding', {
    userId,
    stage: 'professional_categories.replace',
    operationPayload: {
      professional_id: professionalProfile.id,
      category_ids: values.categoryIds,
    },
  });

  try {
    await replaceProfessionalCategories(professionalProfile.id, values.categoryIds);
  } catch (categoriesError) {
    logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding:error', {
      userId,
      stage: 'professional_categories.replace',
      operationPayload: {
        professional_id: professionalProfile.id,
        category_ids: values.categoryIds,
      },
      error: categoriesError,
    });
    throw categoriesError;
  }

  const completionPayload = { onboarding_completed: true } as const;

  logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding', {
    userId,
    stage: 'profiles.complete',
    operationPayload: completionPayload,
  });

  const { data: completedProfile, error: completionError } = await supabase
    .from('profiles')
    .update(completionPayload)
    .eq('id', userId)
    .select('*')
    .single();

  if (completionError) {
    logProfessionalOnboardingDevelopment('profile-api:save-professional-onboarding:error', {
      userId,
      stage: 'profiles.complete',
      operationPayload: completionPayload,
      error: completionError,
    });
    throw completionError;
  }

  return {
    profile: mapProfile(completedProfile as ProfileRow),
    professionalProfile,
    categories: values.categoryIds,
  };
}

export async function updateProfessionalAvailability(status: AvailabilityStatus): Promise<ProfessionalProfile> {
  const { data, error } = await supabase
    .from('professional_profiles')
    .update({ availability_status: status })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProfessionalProfile(data as ProfessionalProfileRow);
}

export interface ProfessionalSummary {
  profile: Profile;
  professionalProfile: ProfessionalProfile | null;
  categories: Category[];
}
