import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockEnsureOwnProfile = jest.fn();
const mockFetchOwnProfessionalProfile = jest.fn();
const mockFetchOwnProfessionalCategoryIds = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      resetPasswordForEmail: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

jest.mock('@/features/profile/api', () => ({
  ensureOwnProfile: (...args: unknown[]) => mockEnsureOwnProfile(...args),
  fetchOwnProfessionalProfile: (...args: unknown[]) => mockFetchOwnProfessionalProfile(...args),
  fetchOwnProfessionalCategoryIds: (...args: unknown[]) => mockFetchOwnProfessionalCategoryIds(...args),
}));

import { AuthProvider, useAuthSession } from '@/features/auth/auth-provider';
import { resolveAppRoute } from '@/features/navigation/access';

const activeQueryClients: QueryClient[] = [];
let consoleErrorSpy: jest.SpyInstance;

function SessionProbe() {
  const { sessionState } = useAuthSession();
  const notice =
    sessionState.status === 'unauthenticated'
      ? sessionState.error ?? ''
      : sessionState.status === 'authenticated'
        ? sessionState.error ?? ''
        : '';

  const route =
    sessionState.status === 'authenticated'
      ? resolveAppRoute({
          isAuthenticated: true,
          profile: sessionState.profile,
          professionalProfile: sessionState.professionalProfile,
          professionalCategoryIds: sessionState.professionalCategoryIds,
        })
      : '/(auth)/login';

  return (
    <>
      <Text testID="status">{sessionState.status}</Text>
      <Text testID="notice">{notice}</Text>
      <Text testID="route">{route}</Text>
    </>
  );
}

function renderAuthProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
  activeQueryClients.push(queryClient);

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { queryClient, ...utils };
}

describe('AuthProvider session validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });

    mockSignOut.mockResolvedValue({ error: null });
    mockFetchOwnProfessionalProfile.mockResolvedValue(null);
    mockFetchOwnProfessionalCategoryIds.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();

    while (activeQueryClients.length > 0) {
      const queryClient = activeQueryClients.pop();
      queryClient?.clear();
    }
  });

  it('keeps a valid restored session authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            email: 'demo@casaticket.local',
          },
        },
      },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'demo@casaticket.local',
        },
      },
      error: null,
    });
    mockEnsureOwnProfile.mockResolvedValue({
      id: 'user-1',
      firstName: 'Demo',
      lastName: 'Valido',
      phone: null,
      avatarPath: null,
      role: null,
      province: 'Buenos Aires',
      city: 'Lanus',
      onboardingCompleted: false,
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('authenticated');
    });

    expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/role-selection');
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureOwnProfile).toHaveBeenCalledWith('user-1');
  });

  it('cleans a stored session when the auth user no longer exists', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            email: 'demo@casaticket.local',
          },
        },
      },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        code: 'user_not_found',
        message: 'User from sub claim in JWT does not exist',
      },
    });

    const { queryClient } = renderAuthProvider();
    queryClient.setQueryData(['profile', 'user-1'], { stale: true });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('unauthenticated');
    });

    expect(screen.getByTestId('notice').props.children).toBe(
      'Tu sesión ya no es válida. Volvé a iniciar sesión.',
    );
    expect(screen.getByTestId('route').props.children).toBe('/(auth)/login');
    expect(mockEnsureOwnProfile).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(queryClient.getQueryData(['profile', 'user-1'])).toBeUndefined();
  });

  it('cleans the session when profile loading hits user_not_found and avoids loops', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            email: 'demo@casaticket.local',
          },
        },
      },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'demo@casaticket.local',
        },
      },
      error: null,
    });
    mockEnsureOwnProfile.mockRejectedValue({
      code: 'user_not_found',
      message: 'User from sub claim in JWT does not exist',
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('unauthenticated');
    });

    expect(screen.getByTestId('route').props.children).toBe('/(auth)/login');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
