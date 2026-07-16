import type { Profile } from '@casaticket/types';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef } from 'react';
import { Text } from 'react-native';

import { queryKeys } from '@/lib/query-keys';

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

const baseProfile: Profile = {
  id: 'user-1',
  firstName: 'Demo',
  lastName: 'Usuario',
  phone: null,
  avatarPath: null,
  role: null,
  province: 'Buenos Aires',
  city: 'Lanus',
  onboardingCompleted: false,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

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
      <Text testID="role">
        {sessionState.status === 'authenticated' ? sessionState.profile?.role ?? '' : ''}
      </Text>
    </>
  );
}

function ProfileMutationProbe({ updatedProfile }: { updatedProfile: Profile }) {
  const { sessionState, setProfileFromMutation } = useAuthSession();
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (
      didSyncRef.current ||
      sessionState.status !== 'authenticated' ||
      sessionState.profile?.role !== null
    ) {
      return;
    }

    didSyncRef.current = true;
    setProfileFromMutation(updatedProfile);
  }, [sessionState, setProfileFromMutation, updatedProfile]);

  return null;
}

function renderAuthProvider(extraChild?: React.ReactNode) {
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

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProbe />
        {extraChild}
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

  function mockAuthenticatedSession() {
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
  }

  it('keeps a valid restored session authenticated', async () => {
    mockAuthenticatedSession();
    mockEnsureOwnProfile.mockResolvedValue(baseProfile);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('authenticated');
    });

    expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/role-selection');
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureOwnProfile).toHaveBeenCalledWith('user-1');
  });

  it('routes a restored customer with incomplete onboarding to customer-profile', async () => {
    mockAuthenticatedSession();
    mockEnsureOwnProfile.mockResolvedValue({
      ...baseProfile,
      role: 'customer',
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/customer-profile');
    });
  });

  it('routes a restored professional with incomplete onboarding to professional-profile', async () => {
    mockAuthenticatedSession();
    mockEnsureOwnProfile.mockResolvedValue({
      ...baseProfile,
      role: 'professional',
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/professional-profile');
    });
  });

  it('syncs profile cache and session state immediately after a customer role mutation', async () => {
    mockAuthenticatedSession();
    mockEnsureOwnProfile.mockResolvedValue(baseProfile);

    const updatedProfile: Profile = {
      ...baseProfile,
      role: 'customer',
    };

    const { queryClient } = renderAuthProvider(
      <ProfileMutationProbe updatedProfile={updatedProfile} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/customer-profile');
    });

    expect(screen.getByTestId('role').props.children).toBe('customer');
    expect(screen.getByTestId('route').props.children).not.toBe('/(onboarding)/role-selection');
    expect(queryClient.getQueryData(queryKeys.profile('user-1'))).toEqual(updatedProfile);
  });

  it('syncs profile cache and session state immediately after a professional role mutation', async () => {
    mockAuthenticatedSession();
    mockEnsureOwnProfile.mockResolvedValue(baseProfile);

    const updatedProfile: Profile = {
      ...baseProfile,
      role: 'professional',
    };

    const { queryClient } = renderAuthProvider(
      <ProfileMutationProbe updatedProfile={updatedProfile} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('route').props.children).toBe('/(onboarding)/professional-profile');
    });

    expect(screen.getByTestId('role').props.children).toBe('professional');
    expect(screen.getByTestId('route').props.children).not.toBe('/(onboarding)/role-selection');
    expect(queryClient.getQueryData(queryKeys.profile('user-1'))).toEqual(updatedProfile);
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
    mockAuthenticatedSession();
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
