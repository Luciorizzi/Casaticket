import type { Profile } from '@casaticket/types';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockSetProfileFromMutation = jest.fn();
const mockUpdateOwnRole = jest.fn();

jest.mock('expo-router', () => ({
  router: {
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
        role: null,
        province: 'Buenos Aires',
        city: 'Lanus',
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

jest.mock('@/features/profile/api', () => ({
  updateOwnRole: (...args: unknown[]) => mockUpdateOwnRole(...args),
}));

import { RoleSelectionScreen } from '@/features/onboarding/role-selection-screen';

const activeQueryClients: QueryClient[] = [];

function createUpdatedProfile(role: 'customer' | 'professional'): Profile {
  return {
    id: 'user-1',
    firstName: '',
    lastName: '',
    phone: null,
    avatarPath: null,
    role,
    province: 'Buenos Aires',
    city: 'Lanus',
    onboardingCompleted: false,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

describe('RoleSelectionScreen', () => {
  let alertSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmAction = buttons?.find((button) => button.text === 'Confirmar');
      confirmAction?.onPress?.();
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    cleanup();

    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop();
      queryClient?.clear();
    }
  });

  function renderScreen() {
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
        <RoleSelectionScreen />
      </QueryClientProvider>,
    );
  }

  it('shows a visible sign-out button during role selection', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Cerrar sesión'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('navigates to customer onboarding immediately after saving the customer role', async () => {
    const updatedProfile = createUpdatedProfile('customer');
    mockUpdateOwnRole.mockResolvedValue(updatedProfile);

    renderScreen();

    fireEvent.press(screen.getByText('Necesito resolver algo en mi casa'));
    fireEvent.press(screen.getByText('Guardar elección'));

    await waitFor(() => {
      expect(mockUpdateOwnRole).toHaveBeenCalled();
    });

    expect(mockUpdateOwnRole.mock.calls[0]?.[0]).toBe('customer');
    expect(mockSetProfileFromMutation).toHaveBeenCalledWith(updatedProfile);
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/customer-profile');
  });

  it('navigates to professional onboarding immediately after saving the professional role', async () => {
    const updatedProfile = createUpdatedProfile('professional');
    mockUpdateOwnRole.mockResolvedValue(updatedProfile);

    renderScreen();

    fireEvent.press(screen.getByText('Quiero ofrecer mis servicios'));
    fireEvent.press(screen.getByText('Guardar elección'));

    await waitFor(() => {
      expect(mockUpdateOwnRole).toHaveBeenCalled();
    });

    expect(mockUpdateOwnRole.mock.calls[0]?.[0]).toBe('professional');
    expect(mockSetProfileFromMutation).toHaveBeenCalledWith(updatedProfile);
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/professional-profile');
  });
});
