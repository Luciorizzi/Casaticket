import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZodError } from 'zod';

import { hasPotentialContactInfo } from '@casaticket/domain';
import type { ApplicationConversation, ApplicationMessage } from '@casaticket/types';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
  getConversation,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
} from '@/features/applications/chat-api';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

interface ApplicationChatScreenProps {
  conversationId: string;
}

export function ApplicationChatScreen({ conversationId }: ApplicationChatScreenProps) {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const currentUserId = sessionState.status === 'authenticated' ? sessionState.user.id : null;
  const listRef = useRef<FlatList<ApplicationMessage> | null>(null);
  const lastMarkedKeyRef = useRef<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const conversationQuery = useQuery({
    queryKey: queryKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: conversationId.length > 0 && currentUserId !== null,
    refetchInterval: isFocused ? 5000 : false,
  });
  const messagesQuery = useQuery({
    queryKey: queryKeys.conversationMessages(conversationId),
    queryFn: () => listConversationMessages(conversationId),
    enabled: conversationId.length > 0 && currentUserId !== null,
    refetchInterval: isFocused ? 5000 : false,
  });
  const refetchConversationRef = useRef(conversationQuery.refetch);
  const refetchMessagesRef = useRef(messagesQuery.refetch);

  useEffect(() => {
    refetchConversationRef.current = conversationQuery.refetch;
    refetchMessagesRef.current = messagesQuery.refetch;
  }, [conversationQuery.refetch, messagesQuery.refetch]);

  const markReadMutation = useMutation({
    mutationFn: markConversationRead,
    onSuccess: (unreadCount) => {
      queryClient.setQueryData<number>(
        queryKeys.conversationUnreadCount(conversationId),
        unreadCount,
      );
      queryClient.setQueryData<ApplicationConversation>(
        queryKeys.conversation(conversationId),
        (currentConversation) =>
          currentConversation ? { ...currentConversation, unreadCount } : currentConversation,
      );
    },
  });
  const markReadRef = useRef(markReadMutation.mutate);

  useEffect(() => {
    markReadRef.current = markReadMutation.mutate;
  }, [markReadMutation.mutate]);

  const sendMutation = useMutation({
    mutationFn: sendConversationMessage,
    onSuccess: (message) => {
      setBody('');
      setError(null);
      queryClient.setQueryData<ApplicationMessage[]>(
        queryKeys.conversationMessages(message.conversationId),
        (currentMessages = []) => {
          if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
            return currentMessages;
          }

          return [...currentMessages, message];
        },
      );
      queryClient.setQueryData<ApplicationConversation>(
        queryKeys.conversation(message.conversationId),
        (currentConversation) =>
          currentConversation
            ? {
                ...currentConversation,
                lastMessageAt: message.createdAt,
                lastMessageBody: message.body,
              }
            : currentConversation,
      );
    },
  });

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      void refetchConversationRef.current();
      void refetchMessagesRef.current();

      return () => {
        setIsFocused(false);
      };
    }, []),
  );

  const conversation = conversationQuery.data ?? null;
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const lastReceivedMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => currentUserId !== null && message.senderUserId !== currentUserId) ?? null,
    [currentUserId, messages],
  );
  const markReadKey =
    conversation && conversation.unreadCount > 0
      ? `${conversation.id}:${conversation.unreadCount}:${lastReceivedMessage?.id ?? 'none'}`
      : null;
  const conversationIdForMarkRead = conversation?.id ?? null;
  const unreadCountForMarkRead = conversation?.unreadCount ?? 0;

  useEffect(() => {
    if (
      !isFocused ||
      !conversationIdForMarkRead ||
      unreadCountForMarkRead <= 0 ||
      !markReadKey
    ) {
      return;
    }

    if (lastMarkedKeyRef.current === markReadKey) {
      return;
    }

    lastMarkedKeyRef.current = markReadKey;
    markReadRef.current(conversationIdForMarkRead);
  }, [conversationIdForMarkRead, isFocused, markReadKey, unreadCountForMarkRead]);

  const contactWarning = hasPotentialContactInfo(body);
  const canSend = Boolean(conversation?.canSend && conversation.status === 'active');
  const trimmedBody = body.trim();
  const statusLabel = getChatStateLabel(conversation);

  if (sessionState.status !== 'authenticated') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState message="Necesitás iniciar sesión para abrir esta conversación." />
      </SafeAreaView>
    );
  }

  if (conversationQuery.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Abriendo conversación..." />
      </SafeAreaView>
    );
  }

  if (conversationQuery.error || !conversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState
          message="No pudimos abrir esta conversación."
          onRetry={() => void conversationQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(conversation.counterpartName)}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.counterpartName}>
              {conversation.counterpartName || 'Conversación privada'}
            </Text>
            <Text style={styles.headerMeta}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.requestSummary}>
          <Text numberOfLines={1} style={styles.requestTitle}>
            Solicitud: {conversation.requestTitle ?? 'Sin título'}
          </Text>
          {conversation.lastMessageAt ? (
            <Text style={styles.requestMeta}>Último mensaje: {formatTime(conversation.lastMessageAt)}</Text>
          ) : (
            <Text style={styles.requestMeta}>Todavía no hay mensajes.</Text>
          )}
        </View>

        {messagesQuery.error ? (
          <ErrorState
            message="No pudimos cargar los mensajes."
            onRetry={() => void messagesQuery.refetch()}
          />
        ) : (
          <FlatList
            contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messagesList}
            data={messages}
            keyExtractor={(message) => message.id}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ref={listRef}
            refreshControl={
              <RefreshControl
                onRefresh={() => void messagesQuery.refetch()}
                refreshing={messagesQuery.isRefetching}
                tintColor={colors.accent}
              />
            }
            renderItem={(info) => (
              <MessageRow currentUserId={sessionState.user.id} messages={messages} {...info} />
            )}
            style={styles.messages}
            ListEmptyComponent={
              messagesQuery.isPending ? (
                <LoadingState message="Cargando mensajes..." />
              ) : (
                <EmptyState
                  description="Usá este espacio para coordinar dentro de CasaTicket."
                  title="Sin mensajes"
                />
              )
            }
          />
        )}

        {contactWarning ? (
          <Text style={styles.warning}>
            Para mantener la seguridad y trazabilidad, coordiná dentro de CasaTicket.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!canSend ? (
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>
              Esta conversación quedó en solo lectura. El historial sigue disponible.
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              maxLength={2000}
              multiline
              onChangeText={setBody}
              placeholder="Escribí tu mensaje..."
              style={styles.input}
              value={body}
            />
            <Button
              disabled={sendMutation.isPending || trimmedBody.length === 0}
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
                    getUserFacingErrorMessage(submissionError, 'No pudimos enviar el mensaje.'),
                  );
                }
              }}
            >
              {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageRow({
  currentUserId,
  index,
  item,
  messages,
}: ListRenderItemInfo<ApplicationMessage> & {
  currentUserId: string;
  messages: ApplicationMessage[];
}) {
  const previousMessage = messages[index - 1] ?? null;
  const showDay = !previousMessage || !isSameDay(previousMessage.createdAt, item.createdAt);
  const isMine = item.senderUserId === currentUserId;

  return (
    <View>
      {showDay ? <Text style={styles.daySeparator}>{formatDay(item.createdAt)}</Text> : null}
      <View style={[styles.messageBubble, isMine ? styles.messageMine : styles.messageOther]}>
        <Text style={[styles.messageBody, isMine ? styles.messageBodyMine : styles.messageBodyOther]}>
          {item.body}
        </Text>
        <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function getChatStateLabel(conversation: ApplicationConversation | null): string {
  if (!conversation || conversation.status !== 'active' || !conversation.canSend) {
    return 'Solo lectura';
  }

  if (conversation.applicationStatus === 'selected') {
    return 'Profesional seleccionado';
  }

  return 'Postulación activa';
}

function getInitials(value: string | null): string {
  const words = (value ?? 'CT').trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function isSameDay(left: string, right: string): boolean {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f1e7',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2d5bf',
    backgroundColor: '#fffaf2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe4d1',
  },
  backText: {
    color: '#1d1811',
    fontSize: 32,
    lineHeight: 34,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#bb5e3c',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  counterpartName: {
    color: '#1d1811',
    fontSize: 17,
    fontWeight: '800',
  },
  headerMeta: {
    color: '#675a49',
    fontSize: 13,
  },
  requestSummary: {
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ddca',
    backgroundColor: '#fdf8ef',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  requestTitle: {
    color: '#1d1811',
    fontSize: 14,
    fontWeight: '700',
  },
  requestMeta: {
    color: '#675a49',
    fontSize: 12,
  },
  messages: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  daySeparator: {
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#eadbc5',
    color: '#675a49',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#bb5e3c',
    borderBottomRightRadius: 4,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
  },
  messageBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageBodyMine: {
    color: '#ffffff',
  },
  messageBodyOther: {
    color: '#1d1811',
  },
  messageTime: {
    alignSelf: 'flex-end',
    fontSize: 11,
  },
  messageTimeMine: {
    color: '#f8e7df',
  },
  messageTimeOther: {
    color: '#7e715f',
  },
  warning: {
    backgroundColor: '#f6e6d0',
    color: '#7a4b14',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  error: {
    color: '#a33b2f',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  readOnlyBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2d5bf',
    backgroundColor: '#fffaf2',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyText: {
    color: '#675a49',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2d5bf',
    backgroundColor: '#fffaf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    color: '#1d1811',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
});
