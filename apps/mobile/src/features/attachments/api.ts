import type { ImagePickerAsset } from 'expo-image-picker';

import { logDevelopmentSupabaseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type AttachmentType = 'request_evidence' | 'diagnosis_evidence' | 'completion_evidence';

export interface Attachment {
  id: string;
  ownerId: string;
  serviceRequestId: string | null;
  jobId: string | null;
  attachmentType: AttachmentType;
  mimeType: string;
  fileSizeBytes: number | null;
  sortOrder: number;
  createdAt: string;
  signedUrl: string;
}

interface AttachmentRow {
  id: string;
  owner_id: string;
  service_request_id: string | null;
  job_id: string | null;
  attachment_type: AttachmentType;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
}

export interface PendingAttachment extends ImagePickerAsset {
  localId: string;
  error?: string;
}

const BUCKET = 'service-attachments';
const SIGNED_URL_TTL_SECONDS = 900;
const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();

async function getSignedUrl(storagePath: string): Promise<string> {
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  signedUrlCache.set(storagePath, { expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000, url: data.signedUrl });
  return data.signedUrl;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function mapAttachment(row: AttachmentRow, signedUrl: string): Attachment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    serviceRequestId: row.service_request_id,
    jobId: row.job_id,
    attachmentType: row.attachment_type,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    signedUrl,
  };
}

export async function listAttachments(parent: { jobId?: string; serviceRequestId?: string }, type: AttachmentType): Promise<Attachment[]> {
  let query = supabase.from('attachments').select('*').eq('attachment_type', type).order('sort_order');
  query = parent.jobId ? query.eq('job_id', parent.jobId) : query.eq('service_request_id', parent.serviceRequestId ?? '');
  const { data, error } = await query;
  if (error) {
    logDevelopmentSupabaseError('attachments:list', error);
    throw error;
  }
  return Promise.all((data as AttachmentRow[]).map(async (row) => mapAttachment(row, await getSignedUrl(row.storage_path))));
}

export async function getRequestAttachmentCounts(requestIds: string[]): Promise<Map<string, number>> {
  if (requestIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('attachments')
    .select('service_request_id')
    .eq('attachment_type', 'request_evidence')
    .in('service_request_id', requestIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data as Array<{ service_request_id: string | null }>) {
    if (row.service_request_id) counts.set(row.service_request_id, (counts.get(row.service_request_id) ?? 0) + 1);
  }
  return counts;
}

export async function uploadAttachment({ asset, jobId, serviceRequestId, sortOrder, type }: {
  asset: PendingAttachment;
  jobId?: string;
  serviceRequestId?: string;
  sortOrder: number;
  type: AttachmentType;
}): Promise<Attachment> {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();
  const size = body.byteLength;
  const { data: registeredData, error: registerError } = await supabase.rpc('register_attachment', {
    p_attachment_type: type,
    p_file_extension: extensionForMime(mimeType),
    p_file_size_bytes: size,
    p_job_id: jobId ?? null,
    p_mime_type: mimeType,
    p_service_request_id: serviceRequestId ?? null,
    p_sort_order: sortOrder,
  });
  if (registerError) throw registerError;
  const row = (registeredData as AttachmentRow[])[0];
  if (!row) throw new Error('No pudimos registrar el adjunto.');

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(row.storage_path, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) {
    await supabase.rpc('delete_own_attachment', { p_attachment_id: row.id });
    throw uploadError;
  }
  return mapAttachment(row, await getSignedUrl(row.storage_path));
}

export async function uploadAttachments(input: {
  assets: PendingAttachment[];
  jobId?: string;
  serviceRequestId?: string;
  type: AttachmentType;
}): Promise<{ failed: PendingAttachment[]; uploaded: Attachment[] }> {
  const uploaded: Attachment[] = [];
  const failed: PendingAttachment[] = [];
  for (const [sortOrder, asset] of input.assets.entries()) {
    try {
      uploaded.push(await uploadAttachment({ ...input, asset, sortOrder }));
    } catch (error) {
      failed.push({ ...asset, error: error instanceof Error ? error.message : 'No se pudo subir.' });
    }
  }
  return { failed, uploaded };
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { data, error } = await supabase.from('attachments').select('storage_path').eq('id', attachmentId).single();
  if (error) throw error;
  const storagePath = (data as { storage_path: string }).storage_path;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;
  const { error: deleteError } = await supabase.rpc('delete_own_attachment', { p_attachment_id: attachmentId });
  if (deleteError) throw deleteError;
  signedUrlCache.delete(storagePath);
}
