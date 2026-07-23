import type {
  Category,
  ProfessionalApplication,
  ProfessionalOpportunity,
  ProfessionalSelectedJob,
} from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
const mockListActiveCategories = jest.fn();
let mockFocusEffectCallback: (() => void | (() => void)) | null = null;
let mockProfessionalCategoryIds = ['category-1'];

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusEffectCallback = callback;
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
      professionalCategoryIds: mockProfessionalCategoryIds,
      error: null,
    },
  }),
}));

jest.mock('@/features/applications/chat-api', () => ({
  ensureApplicationConversation: (...args: unknown[]) => mockEnsureApplicationConversation(...args),
}));

jest.mock('@/features/applications/job-panel', () => ({
  JobPanel: () => null,
}));
jest.mock('@/features/jobs/customer-job-panel', () => ({
  CustomerJobPanel: () => null,
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
  listActiveCategories: (...args: unknown[]) => mockListActiveCategories(...args),
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

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'category-1',
    name: 'Electricidad',
    slug: 'electricidad',
    description: null,
    active: true,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
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
    jobId: 'job-1',
    jobStatus: 'coordination_pending',
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
    mockFocusEffectCallback = null;
    mockProfessionalCategoryIds = ['category-1'];
    mockListProfessionalOpportunities.mockResolvedValue([createOpportunity()]);
    mockListOwnApplications.mockResolvedValue([]);
    mockListProfessionalSelectedJobs.mockResolvedValue([]);
    mockListActiveCategories.mockResolvedValue([
      createCategory(),
      createCategory({ id: 'category-2', name: 'Plomería', slug: 'plomeria' }),
      createCategory({ id: 'category-3', name: 'Pintura', slug: 'pintura' }),
    ]);
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

  it('deduplicates opportunities, keeps withdrawn requests visible and sorts by recent first', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'request-old',
        title: 'Solicitud antigua',
        publishedAt: '2026-07-18T12:00:00.000Z',
      }),
      createOpportunity({
        requestId: 'request-new',
        title: 'Rotura de tecla de luz',
        description: 'Se rompió una tecla de luz del living.',
        publishedAt: '2026-07-22T12:00:00.000Z',
      }),
      createOpportunity({
        requestId: 'request-old',
        title: 'Solicitud antigua duplicada',
        publishedAt: '2026-07-17T12:00:00.000Z',
      }),
      createOpportunity({
        requestId: 'request-withdrawn',
        title: 'Solicitud retirada',
        publishedAt: '2026-07-23T12:00:00.000Z',
      }),
    ]);
    mockListOwnApplications.mockResolvedValue([
      createApplication({ requestId: 'request-withdrawn', status: 'withdrawn' }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });

    const titles = screen.getAllByTestId('opportunity-card-title').map((node) => node.props.children);
    expect(titles).toEqual(['Solicitud retirada', 'Rotura de tecla de luz', 'Solicitud antigua']);
    expect(screen.queryByText('Solicitud antigua duplicada')).toBeNull();
  });

  it('hides opportunities with active own applications', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({ requestId: 'active-application-request', title: 'Ya me postulé' }),
      createOpportunity({ requestId: 'available-request', title: 'Disponible para postularme' }),
    ]);
    mockListOwnApplications.mockResolvedValue([
      createApplication({ requestId: 'active-application-request', status: 'submitted' }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Disponible para postularme')).toBeTruthy();
    });

    expect(screen.queryByText('Ya me postulé')).toBeNull();
  });

  it('shows Electricidad opportunities to professionals with that category', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'electricity-request',
        title: 'Rotura de tecla de luz',
        categoryId: 'category-1',
        categoryName: 'Electricidad',
      }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });
  });

  it('does not show Electricidad opportunities to professionals without that category', async () => {
    mockProfessionalCategoryIds = ['category-3'];
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'electricity-request',
        title: 'Rotura de tecla de luz',
        categoryId: 'category-1',
        categoryName: 'Electricidad',
      }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('No hay oportunidades disponibles.')).toBeTruthy();
    });

    expect(screen.queryByText('Rotura de tecla de luz')).toBeNull();
  });

  it('filters opportunities by category id and includes uncategorized requests', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'electricity-request',
        title: 'Rotura de tecla de luz',
        categoryId: 'category-1',
        categoryName: 'Nombre viejo',
      }),
      createOpportunity({
        requestId: 'uncategorized-request',
        title: 'No sé qué rubro necesito',
        categoryId: null,
        categoryName: null,
      }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });

    expect(screen.getByText('No sé qué rubro necesito')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Filtrar por Categoría'));

    expect(screen.getAllByText('Todas las categorías').length).toBeGreaterThan(0);
    expect(screen.getByText('Electricidad')).toBeTruthy();
    expect(screen.getByText('Pintura')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Buscar categoría'), 'elec');
    expect(screen.getByText('Electricidad')).toBeTruthy();
    expect(screen.queryByText('Pintura')).toBeNull();

    fireEvent.press(screen.getByText('Electricidad'));

    expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    expect(screen.queryByText('No sé qué rubro necesito')).toBeNull();

    fireEvent.press(screen.getByLabelText('Filtrar por Categoría'));
    fireEvent.press(screen.getByText('Sin categoría'));

    expect(screen.getByText('No sé qué rubro necesito')).toBeTruthy();
    expect(screen.queryByText('Rotura de tecla de luz')).toBeNull();
  });

  it('filters opportunities by normalized city with searchable options', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'caba-request',
        title: 'Rotura de tecla de luz',
        city: 'Ciudad Autonoma de Buenos Aires',
      }),
      createOpportunity({
        requestId: 'lanus-request',
        title: 'Tablero en Lanús',
        city: 'Lanus',
      }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Filtrar por Ciudad'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscar ciudad'), 'caba');
    expect(screen.getByText('CABA')).toBeTruthy();
    expect(screen.queryByText('Lanús')).toBeNull();
    fireEvent.press(screen.getByText('CABA'));

    expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    expect(screen.queryByText('Tablero en Lanús')).toBeNull();
  });

  it('filters opportunities by urgency and combines filters', async () => {
    mockListProfessionalOpportunities.mockResolvedValue([
      createOpportunity({
        requestId: 'flexible-caba',
        title: 'Rotura de tecla de luz',
        city: 'Ciudad Autonoma de Buenos Aires',
        urgency: 'flexible',
      }),
      createOpportunity({
        requestId: 'soon-caba',
        title: 'Cortocircuito en cocina',
        city: 'Ciudad Autonoma de Buenos Aires',
        urgency: 'soon',
      }),
      createOpportunity({
        requestId: 'flexible-lanus',
        title: 'Llave térmica en Lanús',
        city: 'Lanus',
        urgency: 'flexible',
      }),
    ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Filtrar por Ciudad'));
    fireEvent.press(screen.getByText('CABA'));
    fireEvent.press(screen.getByLabelText('Filtrar por Urgencia'));
    fireEvent.press(screen.getByText('Flexible'));

    expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    expect(screen.queryByText('Cortocircuito en cocina')).toBeNull();
    expect(screen.queryByText('Llave térmica en Lanús')).toBeNull();

    fireEvent.press(screen.getByText('Limpiar filtros'));

    expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    expect(screen.getByText('Cortocircuito en cocina')).toBeTruthy();
    expect(screen.getByText('Llave térmica en Lanús')).toBeTruthy();
  });

  it('uses a compact refresh icon and ignores repeated presses while refreshing', async () => {
    let resolveRefresh: (value: ProfessionalOpportunity[]) => void = () => undefined;
    mockListProfessionalOpportunities
      .mockResolvedValueOnce([createOpportunity()])
      .mockImplementationOnce(
        () =>
          new Promise<ProfessionalOpportunity[]>((resolve) => {
            resolveRefresh = resolve;
          }),
      );

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Arreglo de pérdida')).toBeTruthy();
    });

    const refreshButton = screen.getByLabelText('Actualizar oportunidades');
    fireEvent.press(refreshButton);
    fireEvent.press(refreshButton);

    expect(mockListProfessionalOpportunities).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Actualizar oportunidades')).toBeNull();

    resolveRefresh([createOpportunity()]);

    await waitFor(() => {
      expect(mockListProfessionalOpportunities).toHaveBeenCalledTimes(2);
    });
  });

  it('refetches once when the opportunities screen receives focus', async () => {
    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Arreglo de pérdida')).toBeTruthy();
    });

    mockListProfessionalOpportunities.mockClear();
    mockListOwnApplications.mockClear();
    mockListActiveCategories.mockClear();

    act(() => {
      void mockFocusEffectCallback?.();
    });

    await waitFor(() => {
      expect(mockListProfessionalOpportunities).toHaveBeenCalledTimes(1);
    });
    expect(mockListOwnApplications).toHaveBeenCalledTimes(1);
    expect(mockListActiveCategories).toHaveBeenCalledTimes(1);
  });

  it('shows newly published opportunities after manual refetch', async () => {
    mockListProfessionalOpportunities
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createOpportunity({
          requestId: 'new-electricity-request',
          title: 'Rotura de tecla de luz',
          categoryId: 'category-1',
          categoryName: 'Electricidad',
        }),
      ]);

    renderWithQueryClient(<ProfessionalOpportunitiesScreen />);

    await waitFor(() => {
      expect(screen.getByText('No hay oportunidades disponibles.')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Actualizar oportunidades'));

    await waitFor(() => {
      expect(screen.getByText('Rotura de tecla de luz')).toBeTruthy();
    });
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
      expect(screen.getByText('Abrir conversación')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Abrir conversación'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[conversationId]',
      params: { conversationId: 'conversation-1' },
    });
    expect(screen.getByText('Abrir conversación')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir conversación'));

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
    expect(screen.getByText('Coordinando visita')).toBeTruthy();
    expect(screen.getByText('Gestionar trabajo')).toBeTruthy();
  });

  it('opens the selected professional job detail', async () => {
    mockListProfessionalSelectedJobs.mockResolvedValue([createSelectedJob()]);

    renderWithQueryClient(<ProfessionalJobsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Gestionar trabajo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Gestionar trabajo'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(professional)/jobs/[jobId]',
      params: { jobId: 'job-1' },
    });
  });

  it('does not navigate to job detail when job id is missing', async () => {
    mockListProfessionalSelectedJobs.mockResolvedValue([createSelectedJob({ jobId: null })]);

    renderWithQueryClient(<ProfessionalJobsScreen />);

    await waitFor(() => {
      expect(screen.getByText('El trabajo todavía no está disponible para gestionar.')).toBeTruthy();
    });

    expect(screen.queryByText('Gestionar trabajo')).toBeNull();
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(professional)/jobs/[jobId]',
      }),
    );
  });

  it('opens the dedicated chat from selected jobs', async () => {
    mockListProfessionalSelectedJobs.mockResolvedValue([
      createSelectedJob({ unreadCount: 3, lastMessageBody: 'Te elegi para el trabajo.' }),
    ]);
    const queryClient = renderWithQueryClient(<ProfessionalJobsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Abrir conversación')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Abrir conversación'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[conversationId]',
      params: { conversationId: 'conversation-1' },
    });
    expect(screen.getByText('Abrir conversación')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir conversación'));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockEnsureApplicationConversation).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.professionalSelectedJobs('professional-1'))).toEqual([
      expect.objectContaining({ conversationId: 'conversation-1', unreadCount: 3 }),
    ]);
  });
});
