import type {
  ProfessionalApplication,
  ProfessionalOpportunity,
  ProfessionalSelectedJob,
} from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { queryKeys } from '@/lib/query-keys';

const mockPush = jest.fn();
const mockCreateApplication = jest.fn();
const mockGetOwnApplication = jest.fn();
const mockGetProfessionalOpportunity = jest.fn();
const mockListOwnApplications = jest.fn();
const mockListProfessionalOpportunities = jest.fn();
const mockListProfessionalSelectedJobs = jest.fn();
const mockWithdrawApplication = jest.fn();
const mockEnsureApplicationConversation = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'pro@casaticket.local',
      },
      profile: {
        id: 'user-1',
        firstName: 'Pro',
        lastName: 'Demo',
        phone: null,
        avatarPath: null,
        role: 'professional',
        province: 'Buenos Aires',
        city: 'Avellaneda',
        onboardingCompleted: true,
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      professionalProfile: {
        id: 'professional-1',
        userId: 'user-1',
        bio: 'Perfil profesional de prueba.',
        yearsExperience: 8,
        baseCity: 'Avellaneda',
        baseLatitude: null,
        baseLongitude: null,
        serviceRadiusKm: 25,
        availabilityStatus: 'available',
        verificationStatus: 'pending',
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      professionalCategoryIds: ['category-1'],
      error: null,
    },
  }),
}));

jest.mock('@/features/applications/chat-api', () => ({
  ensureApplicationConversation: (...args: unknown[]) => mockEnsureApplicationConversation(...args),
}));

jest.mock('@/features/professional/application-form', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const values = {
    message: 'Puedo revisar el problema esta semana con herramientas propias.',
    proposalType: 'diagnostic_visit' as const,
    visitPrice: 5000,
    estimatedPrice: null,
    estimatedDurationText: 'Una visita breve',
    availabilityText: 'Martes por la tarde',
  };

  return {
    ApplicationForm: ({
      loading,
      onSubmit,
    }: {
      loading?: boolean;
      onSubmit: (values: {
        availabilityText: string;
        estimatedDurationText: string;
        estimatedPrice: null;
        message: string;
        proposalType: 'diagnostic_visit';
        visitPrice: number;
      }) => Promise<void>;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          disabled: loading,
          testID: 'application-submit',
          onPress: () => {
            void onSubmit(values);
          },
        },
        React.createElement(Text, null, loading ? 'Enviando...' : 'Enviar postulación'),
      ),
  };
});

jest.mock('@/features/categories/api', () => ({
  listActiveCategories: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  saveProfessionalOnboarding: jest.fn(),
}));

jest.mock('@/features/professional/opportunities-api', () => ({
  createApplication: (...args: unknown[]) => mockCreateApplication(...args),
  getOwnApplication: (...args: unknown[]) => mockGetOwnApplication(...args),
  getProfessionalOpportunity: (...args: unknown[]) => mockGetProfessionalOpportunity(...args),
  listOwnApplications: (...args: unknown[]) => mockListOwnApplications(...args),
  listProfessionalOpportunities: (...args: unknown[]) => mockListProfessionalOpportunities(...args),
  listProfessionalSelectedJobs: (...args: unknown[]) => mockListProfessionalSelectedJobs(...args),
  withdrawApplication: (...args: unknown[]) => mockWithdrawApplication(...args),
}));

import {
  ProfessionalJobsScreen,
  ProfessionalOpportunityDetailScreen,
  ProfessionalOpportunitiesScreen,
} from '@/features/professional/screens';

const activeQueryClients: QueryClient[] = [];

function createOpportunity(overrides: Partial<ProfessionalOpportunity> = {}): ProfessionalOpportunity {
  return {
    requestId: 'request-1',
    title: 'Arreglo de pérdida',
    description: 'Necesito resolver una pérdida debajo de la bacha.',
    categoryId: 'category-1',
    categoryName: 'Plomeria',
    requestType: 'specific_task',
    urgency: 'soon',
    city: 'Lanus',
    province: 'Buenos Aires',
    preferredDate: null,
    preferredTimeText: null,
    availabilityNotes: null,
    publishedAt: '2026-07-20T12:00:00.000Z',
    ...overrides,
  };
}

function createApplication(overrides: Partial<ProfessionalApplication> = {}): ProfessionalApplication {
  return {
    id: 'application-1',
    requestId: 'request-1',
    professionalId: 'professional-1',
    message: 'Puedo revisar el problema esta semana con herramientas propias.',
    proposalType: 'diagnostic_visit',
    visitPrice: 5000,
    estimatedPrice: null,
    estimatedDurationText: 'Una visita breve',
    availabilityText: 'Martes por la tarde',
    status: 'submitted',
    conversationId: 'conversation-1',
    unreadCount: 0,
    lastMessageBody: null,
    lastMessageAt: null,
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    withdrawnAt: null,
    ...overrides,
  };
}

function createSelectedJob(overrides: Partial<ProfessionalSelectedJob> = {}): ProfessionalSelectedJob {
  return {
    applicationId: 'application-1',
    requestId: 'request-1',
    title: 'Arreglo de pérdida',
    categoryName: 'Plomeria',
    city: 'Lanus',
    requestStatus: 'professional_selected',
    selectedAt: '2026-07-20T13:00:00.000Z',
    conversationId: 'conversation-1',
    unreadCount: 0,
    lastMessageBody: null,
    lastMessageAt: null,
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

describe('professional opportunities screens', () => {
  let alertSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      void title;
      void message;
      buttons?.[1]?.onPress?.();
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockListProfessionalOpportunities.mockResolvedValue([createOpportunity()]);
    mockListOwnApplications.mockResolvedValue([]);
    mockListProfessionalSelectedJobs.mockResolvedValue([]);
    mockGetProfessionalOpportunity.mockResolvedValue(createOpportunity());
    mockGetOwnApplication.mockResolvedValue(null);
    mockEnsureApplicationConversation.mockResolvedValue({
      id: 'conversation-1',
      applicationId: 'application-1',
      requestId: 'request-1',
      requestTitle: 'Arreglo de perdida',
      customerId: 'customer-1',
      professionalId: 'professional-1',
      status: 'active',
      applicationStatus: 'submitted',
      requestStatus: 'published',
      counterpartUserId: 'customer-1',
      counterpartName: 'Ana Cliente',
      lastMessageBody: null,
      lastMessageAt: null,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
      unreadCount: 0,
      canSend: true,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    cleanup();

    while (activeQueryClients.length > 0) {
      activeQueryClients.pop()?.clear();
    }
  });

  it('shows opportunities without exact address and opens detail', async () => {
    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Arreglo de pérdida')).toBeTruthy();
    });

    expect(screen.queryByText('Calle privada 123')).toBeNull();
    fireEvent.press(screen.getByText('Arreglo de pérdida'));
    expect(mockPush).toHaveBeenCalledWith('/(professional)/opportunities/request-1');
  });

  it('updates application cache after creating an application', async () => {
    const application = createApplication();
    mockCreateApplication.mockResolvedValue(application);
    const queryClient = renderWithQueryClient(
      <ProfessionalOpportunityDetailScreen requestId="request-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Enviar postulación')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('application-submit'));

    await waitFor(() => {
      expect(mockCreateApplication).toHaveBeenCalled();
    });

    expect(queryClient.getQueryData(queryKeys.professionalApplication('professional-1', 'request-1'))).toEqual(
      application,
    );
    expect(queryClient.getQueryData(queryKeys.professionalApplications('professional-1'))).toEqual([
      application,
    ]);
  });

  it('updates application cache after withdrawing an application', async () => {
    const application = createApplication();
    const withdrawnApplication = createApplication({
      status: 'withdrawn',
      withdrawnAt: '2026-07-20T13:00:00.000Z',
    });
    mockGetOwnApplication.mockResolvedValue(application);
    mockWithdrawApplication.mockResolvedValue(withdrawnApplication);
    const queryClient = renderWithQueryClient(
      <ProfessionalOpportunityDetailScreen requestId="request-1" />,
    );
    queryClient.setQueryData(queryKeys.professionalApplications('professional-1'), [application]);

    await waitFor(() => {
      expect(screen.getByText(/Retirar postulaci/)).toBeTruthy();
    });

    fireEvent.press(screen.getByText(/Retirar postulaci/));

    await waitFor(() => {
      expect(mockWithdrawApplication).toHaveBeenCalledWith('application-1', 'professional-1');
    });

    expect(queryClient.getQueryData(queryKeys.professionalApplication('professional-1', 'request-1'))).toEqual(
      withdrawnApplication,
    );
    expect(queryClient.getQueryData(queryKeys.professionalApplications('professional-1'))).toEqual([
      withdrawnApplication,
    ]);
  });

  it('opens the dedicated chat from an existing application', async () => {
    const application = createApplication({ unreadCount: 1, lastMessageBody: 'Necesito coordinar.' });
    mockGetOwnApplication.mockResolvedValue(application);
    const queryClient = renderWithQueryClient(
      <ProfessionalOpportunityDetailScreen requestId="request-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Abrir conversacion')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Abrir conversacion'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[conversationId]',
      params: { conversationId: 'conversation-1' },
    });
    expect(screen.getByText('Abrir conversacion')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir conversacion'));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockEnsureApplicationConversation).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.professionalApplication('professional-1', 'request-1'))).toMatchObject({
      conversationId: 'conversation-1',
      unreadCount: 1,
    });
  });

  it('shows selected jobs in professional jobs', async () => {
    mockListProfessionalSelectedJobs.mockResolvedValue([createSelectedJob()]);

    renderWithQueryClient(<ProfessionalJobsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Arreglo de pérdida')).toBeTruthy();
    });

    expect(mockListProfessionalSelectedJobs).toHaveBeenCalledWith('professional-1');
    expect(screen.getByText('Profesional seleccionado')).toBeTruthy();
  });

  it('opens the dedicated chat from selected jobs', async () => {
    mockListProfessionalSelectedJobs.mockResolvedValue([
      createSelectedJob({ unreadCount: 3, lastMessageBody: 'Te elegi para el trabajo.' }),
    ]);
    const queryClient = renderWithQueryClient(<ProfessionalJobsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Abrir conversacion')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Abrir conversacion'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[conversationId]',
      params: { conversationId: 'conversation-1' },
    });
    expect(screen.getByText('Abrir conversacion')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir conversacion'));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockEnsureApplicationConversation).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.professionalSelectedJobs('professional-1'))).toEqual([
      expect.objectContaining({ conversationId: 'conversation-1', unreadCount: 3 }),
    ]);
  });
});
