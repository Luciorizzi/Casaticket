import { buildSessionState } from '@/features/auth/session-state';
import { resolveAppRoute } from '@/features/navigation/access';

describe('session state resolution', () => {
  it('starts in loading while the session is being restored', () => {
    expect(
      buildSessionState({
        professionalCategoryIds: [],
        professionalCategoriesError: null,
        professionalCategoriesLoading: false,
        professionalProfile: null,
        professionalProfileError: null,
        professionalProfileLoading: false,
        profile: null,
        profileError: null,
        profileLoading: false,
        session: undefined,
        sessionError: null,
      }),
    ).toEqual({ status: 'loading' });
  });

  it('returns unauthenticated when there is no session', () => {
    expect(
      buildSessionState({
        professionalCategoryIds: [],
        professionalCategoriesError: null,
        professionalCategoriesLoading: false,
        professionalProfile: null,
        professionalProfileError: null,
        professionalProfileLoading: false,
        profile: null,
        profileError: null,
        profileLoading: false,
        session: null,
        sessionError: null,
      }),
    ).toEqual({ status: 'unauthenticated', error: null });
  });

  it('returns the authenticated snapshot when the user and profile are ready', () => {
    const sessionState = buildSessionState({
      professionalCategoryIds: ['cat-1'],
      professionalCategoriesError: null,
      professionalCategoriesLoading: false,
      professionalProfile: {
        id: 'prof-1',
        userId: 'user-1',
        bio: 'Perfil profesional completo para las pruebas.',
        yearsExperience: 4,
        baseCity: 'Lanus',
        baseLatitude: null,
        baseLongitude: null,
        serviceRadiusKm: 20,
        availabilityStatus: 'available',
        verificationStatus: 'pending',
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      professionalProfileError: null,
      professionalProfileLoading: false,
      profile: {
        id: 'user-1',
        firstName: 'Camila',
        lastName: 'Prueba',
        phone: '1122334455',
        avatarPath: null,
        role: 'professional',
        province: 'Buenos Aires',
        city: 'Lanus',
        onboardingCompleted: true,
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      profileError: null,
      profileLoading: false,
      session: {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: 1234567890,
        token_type: 'bearer',
        user: {
          id: 'user-1',
          email: 'demo@casaticket.local',
        },
      } as never,
      sessionError: null,
    });

    expect(sessionState.status).toBe('authenticated');
    if (sessionState.status === 'authenticated') {
      expect(sessionState.user.email).toBe('demo@casaticket.local');
      expect(sessionState.profile?.role).toBe('professional');
    }
  });

  it('keeps loading while an invalid authenticated query is being cleaned up', () => {
    expect(
      buildSessionState({
        professionalCategoryIds: [],
        professionalCategoriesError: null,
        professionalCategoriesLoading: false,
        professionalProfile: null,
        professionalProfileError: null,
        professionalProfileLoading: false,
        profile: null,
        profileError: {
          code: 'user_not_found',
          message: 'User from sub claim in JWT does not exist',
        },
        profileLoading: false,
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: 1234567890,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            email: 'demo@casaticket.local',
          },
        } as never,
        sessionError: null,
      }),
    ).toEqual({ status: 'loading' });
  });
});

describe('route resolution', () => {
  it('routes unauthenticated users back to login', () => {
    expect(
      resolveAppRoute({
        isAuthenticated: false,
        profile: null,
        professionalProfile: null,
        professionalCategoryIds: [],
      }),
    ).toBe('/(auth)/login');
  });

  it('routes a completed customer to the customer app', () => {
    expect(
      resolveAppRoute({
        isAuthenticated: true,
        profile: {
          id: 'user-1',
          firstName: 'Camila',
          lastName: 'Prueba',
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
      }),
    ).toBe('/(customer)/home');
  });

  it('routes a completed professional to the professional app', () => {
    expect(
      resolveAppRoute({
        isAuthenticated: true,
        profile: {
          id: 'user-2',
          firstName: 'Joaquin',
          lastName: 'Demo',
          phone: '1122334455',
          avatarPath: null,
          role: 'professional',
          province: 'Buenos Aires',
          city: 'Avellaneda',
          onboardingCompleted: true,
          createdAt: '2026-07-16T00:00:00.000Z',
          updatedAt: '2026-07-16T00:00:00.000Z',
        },
        professionalProfile: {
          id: 'prof-2',
          userId: 'user-2',
          bio: 'Perfil profesional completo para las pruebas.',
          yearsExperience: 8,
          baseCity: 'Avellaneda',
          baseLatitude: null,
          baseLongitude: null,
          serviceRadiusKm: 35,
          availabilityStatus: 'busy',
          verificationStatus: 'pending',
          createdAt: '2026-07-16T00:00:00.000Z',
          updatedAt: '2026-07-16T00:00:00.000Z',
        },
        professionalCategoryIds: ['cat-1'],
      }),
    ).toBe('/(professional)/home');
  });

  it('routes a user without role to role selection', () => {
    expect(
      resolveAppRoute({
        isAuthenticated: true,
        profile: {
          id: 'user-3',
          firstName: '',
          lastName: '',
          phone: null,
          avatarPath: null,
          role: null,
          province: 'Buenos Aires',
          city: 'Ciudad Autonoma de Buenos Aires',
          onboardingCompleted: false,
          createdAt: '2026-07-16T00:00:00.000Z',
          updatedAt: '2026-07-16T00:00:00.000Z',
        },
        professionalProfile: null,
        professionalCategoryIds: [],
      }),
    ).toBe('/(onboarding)/role-selection');
  });

  it('routes a professional with incomplete onboarding back to onboarding', () => {
    expect(
      resolveAppRoute({
        isAuthenticated: true,
        profile: {
          id: 'user-4',
          firstName: 'Joaquin',
          lastName: 'Demo',
          phone: '1122334455',
          avatarPath: null,
          role: 'professional',
          province: 'Buenos Aires',
          city: 'Avellaneda',
          onboardingCompleted: false,
          createdAt: '2026-07-16T00:00:00.000Z',
          updatedAt: '2026-07-16T00:00:00.000Z',
        },
        professionalProfile: null,
        professionalCategoryIds: [],
      }),
    ).toBe('/(onboarding)/professional-profile');
  });
});
