import type { ApplicationConversation, ApplicationMessage } from '@casaticket/types';
import { createMessageSchema, type CreateMessageInput } from '@casaticket/validation';

import { logDevelopmentSupabaseError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

interface ConversationRow {
  conversation_id: string;
  application_id: string;
  request_id: string;
  request_title?: string | null;
  customer_id: string;
  professional_id: string;
  status: ApplicationConversation['status'];
  application_status?: ApplicationConversation['applicationStatus'];
  request_status?: ApplicationConversation['requestStatus'];
  counterpart_user_id?: string | null;
  counterpart_name?: string | null;
  last_message_body?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
  unread_count: number | null;
  can_send: boolean;
}

interface MessageRow {
  message_id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

function mapConversation(row: ConversationRow): ApplicationConversation {
  return {
    id: row.conversation_id,
    applicationId: row.application_id,
    requestId: row.request_id,
    requestTitle: row.request_title ?? null,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    status: row.status,
    applicationStatus: row.application_status ?? null,
    requestStatus: row.request_status ?? null,
    counterpartUserId: row.counterpart_user_id ?? null,
    counterpartName: row.counterpart_name ?? null,
    lastMessageBody: row.last_message_body ?? null,
    lastMessageAt: row.last_message_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unreadCount: row.unread_count ?? 0,
    canSend: row.can_send,
  };
}

function mapMessage(row: MessageRow): ApplicationMessage {
  return {
    id: row.message_id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  };
}

export async function ensureApplicationConversation(
  applicationId: string,
): Promise<ApplicationConversation> {
  const { data, error } = await supabase.rpc('ensure_application_conversation', {
    p_application_id: applicationId,
  });

  if (error) {
    logDevelopmentSupabaseError('application-chat:ensure-conversation', error);
    throw error;
  }

  const rows = (data ?? []) as ConversationRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No pudimos abrir esta conversación.');
  }

  return mapConversation(firstRow);
}

export async function getConversation(conversationId: string): Promise<ApplicationConversation> {
  const { data, error } = await supabase.rpc('get_conversation', {
    p_conversation_id: conversationId,
  });

  if (error) {
    logDevelopmentSupabaseError('application-chat:get-conversation', error);
    throw error;
  }

  const rows = (data ?? []) as ConversationRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No pudimos abrir esta conversación.');
  }

  return mapConversation(firstRow);
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ApplicationMessage[]> {
  const { data, error } = await supabase.rpc('list_conversation_messages', {
    p_conversation_id: conversationId,
  });

  if (error) {
    logDevelopmentSupabaseError('application-chat:list-messages', error);
    throw error;
  }

  return ((data ?? []) as MessageRow[]).map((row) => mapMessage(row));
}

export async function sendConversationMessage({
  body,
  conversationId,
}: CreateMessageInput & {
  conversationId: string;
}): Promise<ApplicationMessage> {
  const parsed = createMessageSchema.parse({ body });
  const { data, error } = await supabase.rpc('send_conversation_message', {
    p_conversation_id: conversationId,
    p_body: parsed.body,
  });

  if (error) {
    logDevelopmentSupabaseError('application-chat:send-message', error);
    throw error;
  }

  const rows = (data ?? []) as MessageRow[];
  const firstRow = rows[0];

  if (!firstRow) {
    throw new Error('No pudimos enviar el mensaje.');
  }

  return mapMessage(firstRow);
}

export async function markConversationRead(conversationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) {
    logDevelopmentSupabaseError('application-chat:mark-read', error);
    throw error;
  }

  const rows = (data ?? []) as { unread_count: number }[];

  return rows[0]?.unread_count ?? 0;
}
