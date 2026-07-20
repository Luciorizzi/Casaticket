import type { Category, ServiceRequestWithCategory } from '@casaticket/types';
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
const mockListOwnServiceRequests = jest.fn();
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
  listOwnServiceRequests: (...args: unknown[]) => mockListOwnServiceRequests(...args),
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
    publishedAt: '2026-07-20T12:00:00.000Z',
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    deletedAt: null,
    category,
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
});
