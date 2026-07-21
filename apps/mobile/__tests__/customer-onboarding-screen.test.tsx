import type { Profile } from '@casaticket/types';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput as NativeTextInput } from 'react-native';

import { queryKeys } from '@/lib/query-keys';

const mockReplace = jest.fn();
const mockSetProfileFromMutation = jest.fn();
const mockSignOut = jest.fn();
const mockSaveCustomerOnboarding = jest.fn();
const mockFetchOwnDefaultAddress = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    refreshProfile: jest.fn(),
    setProfileFromMutation: mockSetProfileFromMutation,
    signOut: mockSignOut,
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'demo@casaticket.local',
      },
      profile: {
        id: 'user-1',
        firstName: '',
        lastName: '',
        phone: null,
        avatarPath: null,
        role: 'customer',
        province: 'Buenos Aires',
        city: 'Ciudad Autonoma de Buenos Aires',
        onboardingCompleted: false,
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      professionalProfile: null,
      professionalCategoryIds: [],
      error: null,
    },
  }),
}));

jest.mock('@/features/applications/chat-api', () => ({
  ensureApplicationConversation: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  fetchOwnDefaultAddress: () => mockFetchOwnDefaultAddress(),
  saveCustomerOnboarding: (...args: unknown[]) => mockSaveCustomerOnboarding(...args),
}));

jest.mock('@/features/categories/api', () => ({
  listActiveCategories: jest.fn(),
}));

jest.mock('@/features/customer/service-requests-api', () => ({
  cancelOwnServiceRequest: jest.fn(),
  createServiceRequest: jest.fn(),
  getOwnServiceRequest: jest.fn(),
  listCustomerRequestApplications: jest.fn(),
  listOwnServiceRequests: jest.fn(),
  markCustomerApplicationViewed: jest.fn(),
  selectProfessionalForRequest: jest.fn(),
}));

import { CustomerOnboardingScreen } from '@/features/customer/screens';

const activeQueryClients: QueryClient[] = [];

function createCompletedCustomerProfile(): Profile {
  return {
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
  };
}

function renderCustomerOnboardingScreen() {
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

  render(
    <QueryClientProvider client={queryClient}>
      <CustomerOnboardingScreen />
    </QueryClientProvider>,
  );

  return queryClient;
}

function fillValidCustomerForm() {
  const inputs = screen.UNSAFE_getAllByType(NativeTextInput);

  fireEvent.changeText(inputs[0], 'Ana');
  fireEvent.changeText(inputs[1], 'Cliente');
  fireEvent.changeText(inputs[2], '1122334455');
  fireEvent.changeText(inputs[3], 'Lanus');
  fireEvent.changeText(inputs[4], 'Buenos Aires');
}

describe('CustomerOnboardingScreen', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetchOwnDefaultAddress.mockResolvedValue(null);
    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    cleanup();

    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop();
      queryClient?.clear();
    }
  });

  it('prevents submit and shows field validation when the form is invalid', async () => {
    renderCustomerOnboardingScreen();

    fireEvent.press(screen.getByText('Finalizar onboarding'));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio.')).toBeTruthy();
    });

    expect(mockSaveCustomerOnboarding).not.toHaveBeenCalled();
  });

  it('shows a Supabase save error and does not navigate', async () => {
    mockSaveCustomerOnboarding.mockRejectedValue({
      code: '21000',
      message: 'UPDATE requires a WHERE clause',
      details: null,
      hint: null,
    });

    renderCustomerOnboardingScreen();
    fillValidCustomerForm();
    fireEvent.press(screen.getByText('Finalizar onboarding'));

    await waitFor(() => {
      expect(screen.getByText('No pudimos guardar el perfil.')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('updates profile cache and centralized session state after a successful save', async () => {
    const updatedProfile = createCompletedCustomerProfile();
    mockSaveCustomerOnboarding.mockResolvedValue(updatedProfile);

    const queryClient = renderCustomerOnboardingScreen();
    fillValidCustomerForm();
    fireEvent.press(screen.getByText('Finalizar onboarding'));

    await waitFor(() => {
      expect(mockSetProfileFromMutation).toHaveBeenCalledWith(updatedProfile);
    });

    expect(queryClient.getQueryData(queryKeys.profile('user-1'))).toEqual(updatedProfile);
  });

  it('navigates to the customer home after a successful save', async () => {
    mockSaveCustomerOnboarding.mockResolvedValue(createCompletedCustomerProfile());

    renderCustomerOnboardingScreen();
    fillValidCustomerForm();
    fireEvent.press(screen.getByText('Finalizar onboarding'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(customer)/home');
    });
  });

  it('passes the valid form values to the customer onboarding API', async () => {
    mockSaveCustomerOnboarding.mockResolvedValue(createCompletedCustomerProfile());

    renderCustomerOnboardingScreen();
    fillValidCustomerForm();
    fireEvent.press(screen.getByText('Finalizar onboarding'));

    await waitFor(() => {
      expect(mockSaveCustomerOnboarding).toHaveBeenCalled();
    });

    expect(mockSaveCustomerOnboarding.mock.calls[0]?.[0]).toEqual({
        firstName: 'Ana',
        lastName: 'Cliente',
        phone: '1122334455',
        city: 'Lanus',
        province: 'Buenos Aires',
        initialAddress: '',
    });
  });
});
