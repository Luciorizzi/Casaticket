import type { ImagePickerAsset } from 'expo-image-picker';

import type { AvailabilityStatus, VerificationStatus } from '@casaticket/types';

import { deleteAttachment, listAttachments } from '@/features/attachments/api';
import { resolveProfileAvatarUrl } from '@/features/profile/avatar-api';

async function getSupabase() {
  return (await import('@/lib/supabase')).supabase;
}

export interface PublicProfessionalProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  baseCity: string;
  bio: string | null;
  yearsExperience: number | null;
  serviceRadiusKm: number;
  availabilityStatus: AvailabilityStatus;
  verificationStatus: VerificationStatus;
  categoryNames: string[];
  completedJobsCount: number;
  averageRating: number | null;
  reviewsCount: number;
}

export interface PublicProfessionalReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

export interface ProfessionalPortfolioItem {
  id: string;
  professionalId: string;
  jobId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  description: string;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PublicProfileRow {
  professional_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
  base_city: string;
  bio: string | null;
  years_experience: number | null;
  service_radius_km: number;
  availability_status: AvailabilityStatus;
  verification_status: VerificationStatus;
  category_names: string[] | null;
  completed_jobs_count: number;
  average_rating: number | string | null;
  reviews_count: number;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
}

interface PortfolioRow {
  id: string;
  professional_id: string;
  job_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  category?: { name: string } | Array<{ name: string }> | null;
}

export async function getPublicProfessionalProfile(professionalId: string): Promise<PublicProfessionalProfile> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_public_professional_profile', {
    p_professional_id: professionalId,
  });
  if (error) throw error;
  const row = (data as PublicProfileRow[])[0];
  if (!row) throw new Error('El perfil profesional no está disponible.');
  return {
    id: row.professional_id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: await resolveProfileAvatarUrl(row.avatar_path),
    baseCity: row.base_city,
    bio: row.bio,
    yearsExperience: row.years_experience,
    serviceRadiusKm: row.service_radius_km,
    availabilityStatus: row.availability_status,
    verificationStatus: row.verification_status,
    categoryNames: row.category_names ?? [],
    completedJobsCount: row.completed_jobs_count,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    reviewsCount: row.reviews_count,
  };
}

export async function listPublicProfessionalReviews(professionalId: string): Promise<PublicProfessionalReview[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('list_public_professional_reviews', {
    p_professional_id: professionalId,
  });
  if (error) throw error;
  return (data as ReviewRow[]).map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    customerName: row.customer_name,
  }));
}

function mapPortfolioItem(row: PortfolioRow): ProfessionalPortfolioItem {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  return {
    id: row.id,
    professionalId: row.professional_id,
    jobId: row.job_id,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProfessionalPortfolio(professionalId: string): Promise<ProfessionalPortfolioItem[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('professional_portfolio_items')
    .select('*, category:categories(name)')
    .eq('professional_id', professionalId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data as PortfolioRow[]).map(mapPortfolioItem);
}

export async function createPortfolioItem(input: {
  professionalId: string;
  categoryId: string | null;
  title: string;
  description: string;
  sortOrder: number;
}): Promise<ProfessionalPortfolioItem> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('professional_portfolio_items').insert({
    professional_id: input.professionalId,
    category_id: input.categoryId,
    title: input.title.trim(),
    description: input.description.trim(),
    sort_order: input.sortOrder,
    is_visible: true,
  }).select('*, category:categories(name)').single();
  if (error) throw error;
  return mapPortfolioItem(data as PortfolioRow);
}

export async function updatePortfolioItem(itemId: string, patch: { categoryId?: string | null; description?: string; isVisible?: boolean; sortOrder?: number; title?: string }): Promise<void> {
  const supabase = await getSupabase();
  const payload: Record<string, boolean | number | string | null> = { updated_at: new Date().toISOString() };
  if (typeof patch.isVisible === 'boolean') payload.is_visible = patch.isVisible;
  if (typeof patch.sortOrder === 'number') payload.sort_order = patch.sortOrder;
  if (typeof patch.title === 'string') payload.title = patch.title.trim();
  if (typeof patch.description === 'string') payload.description = patch.description.trim();
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
  const { error } = await supabase.from('professional_portfolio_items').update(payload).eq('id', itemId);
  if (error) throw error;
}

export async function deletePortfolioItem(itemId: string): Promise<void> {
  const attachments = await listAttachments({ portfolioItemId: itemId }, 'portfolio');
  for (const attachment of attachments) await deleteAttachment(attachment.id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('professional_portfolio_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function uploadOwnProfessionalAvatar(asset: ImagePickerAsset, previousPath: string | null): Promise<string> {
  const supabase = await getSupabase();
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Tipo de imagen no permitido.');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sesión no disponible.');
  const body = await (await fetch(asset.uri)).arrayBuffer();
  if (body.byteLength < 1 || body.byteLength > 5_242_880) throw new Error('La imagen debe pesar menos de 5 MB.');
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `avatars/${userData.user.id}/profile-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('profile-media').upload(path, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: profileError } = await supabase.rpc('set_own_professional_avatar', { p_avatar_path: path });
  if (profileError) {
    await supabase.storage.from('profile-media').remove([path]);
    throw profileError;
  }
  if (previousPath && previousPath !== path) {
    const { error: cleanupError } = await supabase.storage.from('profile-media').remove([previousPath]);
    if (cleanupError) throw new Error('La foto se actualizÃ³, pero no pudimos limpiar el archivo anterior.');
  }
  return path;
}

export async function removeOwnProfessionalAvatar(): Promise<void> {
  const supabase = await getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sesión no disponible.');
  const { data: profileData, error: profileReadError } = await supabase.from('profiles').select('avatar_path').eq('id', userData.user.id).single();
  if (profileReadError) throw profileReadError;
  const { error } = await supabase.rpc('set_own_professional_avatar', { p_avatar_path: null });
  if (error) throw error;
  if (profileData.avatar_path) {
    const { error: storageError } = await supabase.storage.from('profile-media').remove([profileData.avatar_path]);
    if (storageError) throw storageError;
  }
}
