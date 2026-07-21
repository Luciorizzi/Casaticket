import type { ProfessionalProfile, Profile } from '@casaticket/types';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/lib/query-keys';

const mockReplace = jest.fn();
const mockSetProfileFromMutation = jest.fn();
const mockSignOut = jest.fn();
const mockSaveProfessionalOnboarding = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    setProfileFromMutation: mockSetProfileFromMutation,
    signOut: mockSignOut,
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'pro@casaticket.local',
      },
      profile: {
        id: 'user-1',
        firstName: '',
        lastName: '',
        phone: null,
        avatarPath: null,
        role: 'professional',
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

jest.mock('@/features/professional/professional-profile-form', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const submittedValues = {
    firstName: 'Pro',
    lastName: 'Demo',
    phone: '1122334455',
    city: 'Lanus',
    province: 'Buenos Aires',
    bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
    yearsExperience: 8,
    baseCity: 'Lanus',
    serviceRadiusKm: 25,
    availabilityStatus: 'available',
    categoryIds: ['11111111-1111-4111-8111-111111111111'],
  };

  return {
    ProfessionalProfileForm: ({
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
          testID: 'professional-submit',
          onPress: () => {
            void onSubmit(submittedValues);
          },
        },
        React.createElement(Text, null, loading ? 'Guardando...' : 'Finalizar onboarding'),
      ),
  };
});

jest.mock('@/features/categories/api', () => ({
  listActiveCategories: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  saveProfessionalOnboarding: (...args: unknown[]) => mockSaveProfessionalOnboarding(...args),
}));

jest.mock('@/features/professional/opportunities-api', () => ({
  createApplication: jest.fn(),
  getOwnApplication: jest.fn(),
  getProfessionalOpportunity: jest.fn(),
  listOwnApplications: jest.fn(),
  listProfessionalOpportunities: jest.fn(),
  listProfessionalSelectedJobs: jest.fn(),
  withdrawApplication: jest.fn(),
}));

import { ProfessionalOnboardingScreen } from '@/features/professional/screens';

const activeQueryClients: QueryClient[] = [];

function createCompletedProfessionalProfile(): Profile {
  return {
    id: 'user-1',
    firstName: 'Pro',
    lastName: 'Demo',
    phone: '1122334455',
    avatarPath: null,
    role: 'professional',
    province: 'Buenos Aires',
    city: 'Lanus',
    onboardingCompleted: true,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

function createProfessionalProfile(): ProfessionalProfile {
  return {
    id: 'professional-profile-1',
    userId: 'user-1',
    bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
    yearsExperience: 8,
    baseCity: 'Lanus',
    baseLatitude: null,
    baseLongitude: null,
    serviceRadiusKm: 25,
    availabilityStatus: 'available',
    verificationStatus: 'pending',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

function renderProfessionalOnboardingScreen() {
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
      <ProfessionalOnboardingScreen />
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('ProfessionalOnboardingScreen', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

  it('updates profile, professional profile and categories cache after success', async () => {
    const profile = createCompletedProfessionalProfile();
    const professionalProfile = createProfessionalProfile();
    const categories = ['11111111-1111-4111-8111-111111111111'];
    mockSaveProfessionalOnboarding.mockResolvedValue({
      profile,
      professionalProfile,
      categories,
    });

    const queryClient = renderProfessionalOnboardingScreen();
    fireEvent.press(screen.getByTestId('professional-submit'));

    await waitFor(() => {
      expect(mockSetProfileFromMutation).toHaveBeenCalledWith(profile);
    });

    expect(queryClient.getQueryData(queryKeys.profile('user-1'))).toEqual(profile);
    expect(queryClient.getQueryData(queryKeys.professionalProfile('user-1'))).toEqual(
      professionalProfile,
    );
    expect(queryClient.getQueryData(queryKeys.professionalCategories('user-1'))).toEqual(
      categories,
    );
  });

  it('navigates to the professional home after success', async () => {
    mockSaveProfessionalOnboarding.mockResolvedValue({
      profile: createCompletedProfessionalProfile(),
      professionalProfile: createProfessionalProfile(),
      categories: ['11111111-1111-4111-8111-111111111111'],
    });

    renderProfessionalOnboardingScreen();
    fireEvent.press(screen.getByTestId('professional-submit'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(professional)/home');
    });
  });

  it('does not navigate when an intermediate save operation fails', async () => {
    mockSaveProfessionalOnboarding.mockRejectedValue({
      code: '23503',
      message: 'insert or update on table violates foreign key constraint',
      details: null,
      hint: null,
    });

    renderProfessionalOnboardingScreen();
    fireEvent.press(screen.getByTestId('professional-submit'));

    await waitFor(() => {
      expect(screen.getByText('No pudimos guardar tu perfil profesional.')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
