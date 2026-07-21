import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ZodError } from 'zod';

import { getConversationStatusLabel, hasPotentialContactInfo } from '@casaticket/domain';
import type { ApplicationConversation, ApplicationMessage } from '@casaticket/types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  ensureApplicationConversation,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
} from '@/features/applications/chat-api';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

interface ApplicationChatPanelProps {
  applicationId: string;
  currentUserId: string;
  onConversationUpdated?: (conversation: ApplicationConversation) => void;
  onUnreadCountChange?: (applicationId: string, unreadCount: number) => void;
  title?: string;
}

export function ApplicationChatPanel({
  applicationId,
  currentUserId,
  onConversationUpdated,
  onUnreadCountChange,
  title = 'Conversación privada',
}: ApplicationChatPanelProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView | null>(null);
  const lastMarkedKeyRef = useRef<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const conversationQuery = useQuery({
    queryKey: queryKeys.applicationConversation(applicationId),
    queryFn: () => ensureApplicationConversation(applicationId),
  });
  const conversation = conversationQuery.data ?? null;
  const messagesQuery = useQuery({
    queryKey: conversation
      ? queryKeys.conversationMessages(conversation.id)
      : ['conversation-messages', applicationId],
    queryFn: () => listConversationMessages(conversation?.id ?? ''),
    enabled: Boolean(conversation),
    refetchInterval: conversation?.status === 'active' ? 15000 : false,
  });
  const markReadMutation = useMutation({
    mutationFn: markConversationRead,
    onSuccess: (unreadCount) => {
      onUnreadCountChange?.(applicationId, unreadCount);
    },
  });
  const markReadAsyncRef = useRef(markReadMutation.mutateAsync);
  const sendMutation = useMutation({
    mutationFn: sendConversationMessage,
    onSuccess: (message) => {
      setBody('');
      setError(null);
      queryClient.setQueryData<ApplicationMessage[]>(
        queryKeys.conversationMessages(message.conversationId),
        (currentMessages = []) => [...currentMessages, message],
      );
      void messagesQuery.refetch();
      void conversationQuery.refetch();
      onUnreadCountChange?.(applicationId, 0);
    },
  });

  useEffect(() => {
    if (conversation) {
      onConversationUpdated?.(conversation);
    }
  }, [conversation, onConversationUpdated]);

  useEffect(() => {
    markReadAsyncRef.current = markReadMutation.mutateAsync;
  }, [markReadMutation.mutateAsync]);

  const lastReceivedMessage = [...(messagesQuery.data ?? [])]
    .reverse()
    .find((message) => message.senderUserId !== currentUserId);
  const conversationIdForMarkRead = conversation?.id ?? null;
  const unreadCountForMarkRead = conversation?.unreadCount ?? 0;
  const markReadKey =
    conversationIdForMarkRead && unreadCountForMarkRead > 0
      ? `${conversationIdForMarkRead}:${unreadCountForMarkRead}:${lastReceivedMessage?.id ?? 'none'}`
      : null;

  useEffect(() => {
    if (!conversationIdForMarkRead || unreadCountForMarkRead <= 0 || !markReadKey) {
      return;
    }

    if (lastMarkedKeyRef.current === markReadKey) {
      return;
    }

    lastMarkedKeyRef.current = markReadKey;
    void markReadAsyncRef.current(conversationIdForMarkRead);
  }, [conversationIdForMarkRead, markReadKey, unreadCountForMarkRead]);

  if (conversationQuery.isPending) {
    return (
      <Card>
        <LoadingState message="Abriendo conversación..." />
      </Card>
    );
  }

  if (conversationQuery.error || !conversation) {
    return (
      <Card>
        <ErrorState
          message="No pudimos abrir la conversación."
          onRetry={() => void conversationQuery.refetch()}
        />
      </Card>
    );
  }

  const messages = messagesQuery.data ?? [];
  const contactWarning = hasPotentialContactInfo(body);
  const canSend = conversation.canSend && conversation.status === 'active';

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Estado: {getConversationStatusLabel(conversation.status)}</Text>
        </View>
        {conversation.unreadCount > 0 ? (
          <Text style={styles.unreadBadge}>{conversation.unreadCount}</Text>
        ) : null}
      </View>
      <Button
        onPress={() => {
          void conversationQuery.refetch();
          void messagesQuery.refetch();
        }}
        variant="secondary"
      >
        Actualizar chat
      </Button>

      {messagesQuery.isPending ? <LoadingState message="Cargando mensajes..." /> : null}
      {messagesQuery.error ? (
        <ErrorState
          message="No pudimos cargar los mensajes."
          onRetry={() => void messagesQuery.refetch()}
        />
      ) : null}
      {!messagesQuery.isPending && !messagesQuery.error && messages.length === 0 ? (
        <EmptyState
          description="Todavía no hay mensajes. Usá este espacio para coordinar dentro de CasaTicket."
          title="Sin mensajes"
        />
      ) : null}
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        style={styles.messages}
      >
        {messages.map((message) => (
          <MessageBubble currentUserId={currentUserId} key={message.id} message={message} />
        ))}
      </ScrollView>

      {contactWarning ? (
        <Text style={styles.warning}>
          Para mantener la seguridad y trazabilidad, coordiná dentro de CasaTicket.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!canSend ? (
        <Text style={styles.meta}>Esta conversación quedó en solo lectura.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setBody}
            placeholder="Escribí tu mensaje..."
            style={styles.input}
            value={body}
          />
          <Button
            disabled={sendMutation.isPending || body.trim().length === 0}
            onPress={async () => {
              setError(null);

              try {
                await sendMutation.mutateAsync({
                  body,
                  conversationId: conversation.id,
                });
              } catch (submissionError) {
                if (submissionError instanceof ZodError) {
                  setError(submissionError.issues[0]?.message ?? 'Revisá el mensaje.');
                  return;
                }

                setError(
                  getUserFacingErrorMessage(
                    submissionError,
                    'No pudimos enviar el mensaje.',
                  ),
                );
              }
            }}
          >
            {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </View>
      )}
    </Card>
  );
}

function MessageBubble({
  currentUserId,
  message,
}: {
  currentUserId: string;
  message: ApplicationMessage;
}) {
  const isMine = message.senderUserId === currentUserId;

  return (
    <View style={[styles.messageBubble, isMine ? styles.messageMine : styles.messageOther]}>
      <Text style={styles.messageBody}>{message.body}</Text>
      <Text style={styles.messageTime}>{formatDateTime(message.createdAt)}</Text>
    </View>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1811',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#675a49',
  },
  unreadBadge: {
    minWidth: 28,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#bb5e3c',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  messages: {
    maxHeight: 320,
  },
  messageBubble: {
    borderRadius: 14,
    gap: 4,
    marginBottom: 10,
    padding: 12,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#f2ddd1',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee4d2',
  },
  messageBody: {
    fontSize: 15,
    lineHeight: 21,
    color: '#1d1811',
  },
  messageTime: {
    fontSize: 11,
    color: '#675a49',
  },
  warning: {
    borderRadius: 12,
    backgroundColor: '#f6e6d0',
    color: '#7a4b14',
    fontSize: 13,
    lineHeight: 19,
    padding: 10,
  },
  error: {
    color: '#a33b2f',
    fontSize: 13,
    lineHeight: 19,
  },
  composer: {
    gap: 10,
  },
  input: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    color: '#1d1811',
    fontSize: 15,
    padding: 12,
    textAlignVertical: 'top',
  },
});
