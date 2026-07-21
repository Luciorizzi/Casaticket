const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  ensureApplicationConversation,
  getConversation,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
} from '@/features/applications/chat-api';

describe('application chat api', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('gets a conversation by id for the dedicated chat route', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          conversation_id: 'conversation-1',
          application_id: 'application-1',
          request_id: 'request-1',
          request_title: 'Arreglo de perdida',
          customer_id: 'customer-1',
          professional_id: 'professional-1',
          status: 'active',
          application_status: 'selected',
          request_status: 'professional_selected',
          counterpart_user_id: 'professional-user-1',
          counterpart_name: 'Pro Demo',
          last_message_body: 'Hola',
          last_message_at: '2026-07-20T12:00:00.000Z',
          created_at: '2026-07-20T12:00:00.000Z',
          updated_at: '2026-07-20T12:00:00.000Z',
          unread_count: 1,
          can_send: true,
        },
      ],
      error: null,
    });

    const conversation = await getConversation('conversation-1');

    expect(mockRpc).toHaveBeenCalledWith('get_conversation', {
      p_conversation_id: 'conversation-1',
    });
    expect(conversation).toMatchObject({
      id: 'conversation-1',
      applicationStatus: 'selected',
      counterpartName: 'Pro Demo',
      lastMessageBody: 'Hola',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('ensures a unique conversation for an application', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          conversation_id: 'conversation-1',
          application_id: 'application-1',
          request_id: 'request-1',
          customer_id: 'customer-1',
          professional_id: 'professional-1',
          status: 'active',
          created_at: '2026-07-20T12:00:00.000Z',
          updated_at: '2026-07-20T12:00:00.000Z',
          unread_count: 3,
          can_send: true,
        },
      ],
      error: null,
    });

    const conversation = await ensureApplicationConversation('application-1');

    expect(mockRpc).toHaveBeenCalledWith('ensure_application_conversation', {
      p_application_id: 'application-1',
    });
    expect(conversation).toMatchObject({
      id: 'conversation-1',
      unreadCount: 3,
      canSend: true,
    });
  });

  it('lists conversation messages in chronological order from RPC result', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-1',
          conversation_id: 'conversation-1',
          sender_user_id: 'customer-1',
          body: 'Hola',
          created_at: '2026-07-20T12:00:00.000Z',
          edited_at: null,
          deleted_at: null,
        },
      ],
      error: null,
    });

    const messages = await listConversationMessages('conversation-1');

    expect(mockRpc).toHaveBeenCalledWith('list_conversation_messages', {
      p_conversation_id: 'conversation-1',
    });
    expect(messages[0]).toMatchObject({
      id: 'message-1',
      body: 'Hola',
    });
  });

  it('trims and sends a valid message', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          message_id: 'message-1',
          conversation_id: 'conversation-1',
          sender_user_id: 'customer-1',
          body: 'Hola',
          created_at: '2026-07-20T12:00:00.000Z',
          edited_at: null,
          deleted_at: null,
        },
      ],
      error: null,
    });

    await sendConversationMessage({
      body: '  Hola  ',
      conversationId: 'conversation-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('send_conversation_message', {
      p_conversation_id: 'conversation-1',
      p_body: 'Hola',
    });
  });

  it('rejects empty messages before calling Supabase', async () => {
    await expect(
      sendConversationMessage({
        body: '   ',
        conversationId: 'conversation-1',
      }),
    ).rejects.toThrow();

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('marks a conversation as read through the RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ conversation_id: 'conversation-1', unread_count: 0 }],
      error: null,
    });

    await expect(markConversationRead('conversation-1')).resolves.toBe(0);

    expect(mockRpc).toHaveBeenCalledWith('mark_conversation_read', {
      p_conversation_id: 'conversation-1',
    });
  });
});
