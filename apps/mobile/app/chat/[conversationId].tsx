import { useLocalSearchParams } from 'expo-router';

import { ApplicationChatScreen } from '@/features/applications/chat-screen';

export default function ConversationRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();

  return <ApplicationChatScreen conversationId={conversationId ?? ''} />;
}
