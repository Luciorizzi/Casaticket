import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockSignOut = jest.fn();
const mockRefreshProfile = jest.fn();

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    refreshProfile: mockRefreshProfile,
    signOut: mockSignOut,
    sessionState: {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'demo@casaticket.local',
      },
      profile: null,
      professionalProfile: null,
      professionalCategoryIds: [],
      error: null,
    },
  }),
}));

jest.mock('@/features/profile/api', () => ({
  updateOwnRole: jest.fn(),
}));

import { RoleSelectionScreen } from '@/features/onboarding/role-selection-screen';

describe('RoleSelectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it('shows a visible sign-out button during role selection', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RoleSelectionScreen />
      </QueryClientProvider>,
    );

    fireEvent.press(screen.getByText('Cerrar sesión'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
