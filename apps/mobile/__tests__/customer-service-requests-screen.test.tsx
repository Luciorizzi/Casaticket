import type {
  Category,
  CustomerRequestApplication,
  ServiceRequestWithCategory,
} from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { queryKeys } from '@/lib/query-keys';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCreateServiceRequest = jest.fn();
const mockGetOwnServiceRequest = jest.fn();
const mockCancelOwnServiceRequest = jest.fn();
const mockListCustomerRequestApplications = jest.fn();
const mockListOwnServiceRequests = jest.fn();
const mockMarkCustomerApplicationViewed = jest.fn();
const mockSelectProfessionalForRequest = jest.fn();
const mockListActiveCategories = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'customer@casaticket.local',
      },
      profile: {
        id: 'user-1',
        firstName: 'Ana',
        lastName: 'Cliente',
        phone: '1122334455',
        avatarPath: null,
        role: 'customer',
        province: 'Buenos Aires',
        city: 'Lanus',
        onboardingCompleted: true,
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      professionalProfile: null,
      professionalCategoryIds: [],
      error: null,
    },
  }),
}));

jest.mock('@/features/applications/chat-panel', () => ({
  ApplicationChatPanel: () => null,
}));

jest.mock('@/features/customer/service-request-form', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const submittedValues = {
    title: 'Arreglo de pérdida',
    description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
    categoryId: 'category-1',
    unsureCategory: false,
    requestType: 'specific_task',
    urgency: 'soon',
    addressText: 'Calle 123',
    city: 'Lanus',
    province: 'Buenos Aires',
    preferredDate: null,
    preferredTimeText: null,
    availabilityNotes: null,
  };

  return {
    ServiceRequestForm: ({
      loading,
      onSubmit,
    }: {
      loading?: boolean;
      onSubmit: (values: typeof submittedValues) => Promise<void>;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          disabled: loading,
          testID: 'create-service-request-submit',
          onPress: () => {
            void onSubmit(submittedValues);
          },
        },
        React.createElement(Text, null, loading ? 'Publicando...' : 'Publicar solicitud'),
      ),
  };
});

jest.mock('@/features/customer/service-requests-api', () => ({
  cancelOwnServiceRequest: (...args: unknown[]) => mockCancelOwnServiceRequest(...args),
  createServiceRequest: (...args: unknown[]) => mockCreateServiceRequest(...args),
  getOwnServiceRequest: (...args: unknown[]) => mockGetOwnServiceRequest(...args),
  listCustomerRequestApplications: (...args: unknown[]) => mockListCustomerRequestApplications(...args),
  listOwnServiceRequests: (...args: unknown[]) => mockListOwnServiceRequests(...args),
  markCustomerApplicationViewed: (...args: unknown[]) => mockMarkCustomerApplicationViewed(...args),
  selectProfessionalForRequest: (...args: unknown[]) => mockSelectProfessionalForRequest(...args),
}));

jest.mock('@/features/categories/api', () => ({
  listActiveCategories: (...args: unknown[]) => mockListActiveCategories(...args),
}));

jest.mock('@/features/profile/api', () => ({
  fetchOwnDefaultAddress: jest.fn(),
  saveCustomerOnboarding: jest.fn(),
}));

import {
  CustomerCreateRequestScreen,
  CustomerRequestDetailScreen,
} from '@/features/customer/screens';

const activeQueryClients: QueryClient[] = [];

const category: Category = {
  id: 'category-1',
  name: 'Plomeria',
  slug: 'plomeria',
  description: null,
  active: true,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

function createRequest(overrides: Partial<ServiceRequestWithCategory> = {}): ServiceRequestWithCategory {
  return {
    id: 'request-1',
    customerId: 'user-1',
    categoryId: category.id,
    title: 'Arreglo de pérdida',
    description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
    requestType: 'specific_task',
    urgency: 'soon',
    addressText: 'Calle 123',
    city: 'Lanus',
    province: 'Buenos Aires',
    preferredDate: null,
    preferredTimeText: null,
    availabilityNotes: null,
    status: 'published',
    selectedProfessionalId: null,
    selectedAt: null,
    publishedAt: '2026-07-20T12:00:00.000Z',
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    deletedAt: null,
    category,
    ...overrides,
  };
}

function createCustomerApplication(
  overrides: Partial<CustomerRequestApplication> = {},
): CustomerRequestApplication {
  return {
    id: 'application-1',
    requestId: 'request-1',
    professionalId: 'professional-1',
    status: 'submitted',
    message: 'Puedo revisar la pérdida esta semana.',
    proposalType: 'diagnostic_visit',
    visitPrice: 5000,
    estimatedPrice: null,
    estimatedDurationText: 'Una visita',
    availabilityText: 'Martes por la tarde',
    createdAt: '2026-07-20T12:00:00.000Z',
    conversationId: 'conversation-1',
    unreadCount: 0,
    professionalFirstName: 'Pro',
    professionalLastName: 'Demo',
    professionalBio: 'Bio pública.',
    professionalYearsExperience: 8,
    professionalBaseCity: 'Lanus',
    professionalServiceRadiusKm: 20,
    professionalVerificationStatus: 'pending',
    professionalCategoryNames: ['Plomeria'],
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

describe('customer service request screens', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      void title;
      void message;
      buttons?.[1]?.onPress?.();
    });
    mockListActiveCategories.mockResolvedValue([category]);
    mockListCustomerRequestApplications.mockResolvedValue([]);
    mockMarkCustomerApplicationViewed.mockResolvedValue({
      application_id: 'application-1',
      status: 'viewed',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
    cleanup();

    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop();
      queryClient?.clear();
    }
  });

  it('updates cache and navigates to detail after creating a request', async () => {
    const createdRequest = createRequest();
    mockCreateServiceRequest.mockResolvedValue(createdRequest);
    const queryClient = renderWithQueryClient(<CustomerCreateRequestScreen />);

    fireEvent.press(screen.getByTestId('create-service-request-submit'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(customer)/requests/request-1');
    });

    expect(queryClient.getQueryData(queryKeys.serviceRequest('user-1', 'request-1'))).toEqual(
      createdRequest,
    );
    expect(queryClient.getQueryData(queryKeys.serviceRequests('user-1'))).toEqual([createdRequest]);
  });

  it('updates cache after cancelling a published request', async () => {
    const publishedRequest = createRequest();
    const cancelledRequest = createRequest({ status: 'cancelled' });
    mockGetOwnServiceRequest.mockResolvedValue(publishedRequest);
    mockCancelOwnServiceRequest.mockResolvedValue(cancelledRequest);
    const queryClient = renderWithQueryClient(<CustomerRequestDetailScreen requestId="request-1" />);
    queryClient.setQueryData(queryKeys.serviceRequests('user-1'), [publishedRequest]);

    await waitFor(() => {
      expect(screen.getByText('Cancelar solicitud')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar solicitud'));

    await waitFor(() => {
      expect(mockCancelOwnServiceRequest.mock.calls[0]?.[0]).toBe('request-1');
    });

    expect(queryClient.getQueryData(queryKeys.serviceRequest('user-1', 'request-1'))).toEqual(
      cancelledRequest,
    );
    expect(queryClient.getQueryData(queryKeys.serviceRequests('user-1'))).toEqual([
      cancelledRequest,
    ]);
  });

  it('shows customer applications and marks a submitted proposal as viewed', async () => {
    mockGetOwnServiceRequest.mockResolvedValue(createRequest());
    mockListCustomerRequestApplications.mockResolvedValue([createCustomerApplication()]);
    renderWithQueryClient(<CustomerRequestDetailScreen requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Profesionales interesados')).toBeTruthy();
    });

    expect(screen.getByText('Pro Demo')).toBeTruthy();
    fireEvent.press(screen.getByText('Ver perfil y propuesta'));

    await waitFor(() => {
      expect(mockMarkCustomerApplicationViewed.mock.calls[0]?.[0]).toBe('application-1');
    });
    expect(screen.getByText('Perfil publico')).toBeTruthy();
  });

  it('updates request and applications cache after selecting a professional', async () => {
    const publishedRequest = createRequest();
    const selectedApplication = createCustomerApplication();
    const rejectedApplication = createCustomerApplication({
      id: 'application-2',
      professionalId: 'professional-2',
      professionalFirstName: 'Otra',
      professionalLastName: 'Pro',
    });
    mockGetOwnServiceRequest.mockResolvedValue(publishedRequest);
    mockListCustomerRequestApplications.mockResolvedValue([selectedApplication, rejectedApplication]);
    mockSelectProfessionalForRequest.mockResolvedValue({
      requestId: 'request-1',
      requestStatus: 'professional_selected',
      selectedProfessionalId: 'professional-1',
      selectedApplicationId: 'application-1',
      selectedAt: '2026-07-20T13:00:00.000Z',
    });
    const queryClient = renderWithQueryClient(<CustomerRequestDetailScreen requestId="request-1" />);
    queryClient.setQueryData(queryKeys.serviceRequests('user-1'), [publishedRequest]);

    await waitFor(() => {
      expect(screen.getAllByText('Ver perfil y propuesta')[0]).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Ver perfil y propuesta')[0]);
    fireEvent.press(screen.getByText('Seleccionar profesional'));

    await waitFor(() => {
      expect(mockSelectProfessionalForRequest).toHaveBeenCalledWith('request-1', 'application-1');
    });

    expect(queryClient.getQueryData(queryKeys.serviceRequest('user-1', 'request-1'))).toMatchObject({
      status: 'professional_selected',
      selectedProfessionalId: 'professional-1',
    });
    expect(queryClient.getQueryData(queryKeys.customerRequestApplications('user-1', 'request-1'))).toEqual([
      expect.objectContaining({ id: 'application-1', status: 'selected' }),
      expect.objectContaining({ id: 'application-2', status: 'rejected' }),
    ]);
  });
});
