import type { ApplicationConversation, ApplicationMessage } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockGetConversation = jest.fn();
const mockListConversationMessages = jest.fn();
const mockMarkConversationRead = jest.fn();
const mockSendConversationMessage = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');

  return {
    router: {
      back: (...args: unknown[]) => mockBack(...args),
    },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'customer-1',
        email: 'customer@casaticket.local',
      },
    },
  }),
}));

jest.mock('@/features/applications/chat-api', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  listConversationMessages: (...args: unknown[]) => mockListConversationMessages(...args),
  markConversationRead: (...args: unknown[]) => mockMarkConversationRead(...args),
  sendConversationMessage: (...args: unknown[]) => mockSendConversationMessage(...args),
}));

import { ApplicationChatScreen } from '@/features/applications/chat-screen';
import { queryKeys } from '@/lib/query-keys';

const activeQueryClients: QueryClient[] = [];

function createConversation(overrides: Partial<ApplicationConversation> = {}): ApplicationConversation {
  return {
    id: 'conversation-1',
    applicationId: 'application-1',
    requestId: 'request-1',
    requestTitle: 'Arreglo de perdida',
    customerId: 'customer-1',
    professionalId: 'professional-1',
    status: 'active',
    applicationStatus: 'submitted',
    requestStatus: 'published',
    counterpartUserId: 'professional-user-1',
    counterpartName: 'Pro Demo',
    lastMessageBody: null,
    lastMessageAt: null,
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    unreadCount: 0,
    canSend: true,
    ...overrides,
  };
}

function createMessage(overrides: Partial<ApplicationMessage> = {}): ApplicationMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderUserId: 'professional-user-1',
    body: 'Hola, puedo ayudarte.',
    createdAt: '2026-07-20T12:05:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        gcTime: Number.POSITIVE_INFINITY,
      },
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
  activeQueryClients.push(queryClient);

  render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);

  return queryClient;
}

describe('application chat screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConversation.mockResolvedValue(createConversation());
    mockListConversationMessages.mockResolvedValue([]);
    mockMarkConversationRead.mockResolvedValue(0);
  });

  afterEach(() => {
    cleanup();

    while (activeQueryClients.length > 0) {
      activeQueryClients.pop()?.clear();
    }
  });

  it('marks unread messages once without a render loop', async () => {
    mockGetConversation.mockResolvedValue(createConversation({ unreadCount: 2 }));
    mockListConversationMessages.mockResolvedValue([createMessage()]);
    const queryClient = renderWithQueryClient(
      <ApplicationChatScreen conversationId="conversation-1" />,
    );

    await waitFor(() => {
      expect(mockMarkConversationRead.mock.calls[0]?.[0]).toBe('conversation-1');
    });

    await waitFor(() => {
      expect(mockMarkConversationRead).toHaveBeenCalledTimes(1);
    });
    expect(queryClient.getQueryData(queryKeys.conversationUnreadCount('conversation-1'))).toBe(0);
  });

  it('sends a message and updates the messages cache', async () => {
    const sentMessage = createMessage({
      id: 'message-2',
      senderUserId: 'customer-1',
      body: 'Perfecto, coordinemos por aca.',
    });
    mockSendConversationMessage.mockResolvedValue(sentMessage);
    const queryClient = renderWithQueryClient(
      <ApplicationChatScreen conversationId="conversation-1" />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribí tu mensaje...')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu mensaje...'), sentMessage.body);
    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => {
      expect(mockSendConversationMessage.mock.calls[0]?.[0]).toEqual({
        body: sentMessage.body,
        conversationId: 'conversation-1',
      });
    });
    expect(queryClient.getQueryData(queryKeys.conversationMessages('conversation-1'))).toEqual([
      sentMessage,
    ]);
  });

  it('keeps the typed body when sending fails', async () => {
    mockSendConversationMessage.mockRejectedValue(new Error('network'));
    renderWithQueryClient(<ApplicationChatScreen conversationId="conversation-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribí tu mensaje...')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Escribí tu mensaje...'), 'Mensaje importante');
    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => {
      expect(screen.getByText('No pudimos conectarnos. Verifica tu conexion e intenta otra vez.')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('Mensaje importante')).toBeTruthy();
  });

  it('shows read only state for rejected conversations', async () => {
    mockGetConversation.mockResolvedValue(
      createConversation({
        status: 'read_only',
        applicationStatus: 'rejected',
        canSend: false,
      }),
    );
    renderWithQueryClient(<ApplicationChatScreen conversationId="conversation-1" />);

    await waitFor(() => {
      expect(screen.getByText('Solo lectura')).toBeTruthy();
    });

    expect(screen.queryByText('Enviar')).toBeNull();
    expect(screen.getByText('Esta conversación quedó en solo lectura. El historial sigue disponible.')).toBeTruthy();
  });

  it('keeps selected applications active', async () => {
    mockGetConversation.mockResolvedValue(
      createConversation({
        applicationStatus: 'selected',
        canSend: true,
        status: 'active',
      }),
    );
    renderWithQueryClient(<ApplicationChatScreen conversationId="conversation-1" />);

    await waitFor(() => {
      expect(screen.getByText('Profesional seleccionado')).toBeTruthy();
    });
    expect(screen.getByText('Enviar')).toBeTruthy();
  });
});
