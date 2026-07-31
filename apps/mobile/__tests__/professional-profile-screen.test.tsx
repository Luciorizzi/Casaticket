import type { Category, ProfessionalProfile, Profile } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSignOut = jest.fn();
const mockSetProfileFromMutation = jest.fn();
const mockSaveProfessionalOnboarding = jest.fn();
const mockListActiveCategories = jest.fn();
const mockResolveProfileAvatarUrl = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

const profile: Profile = {
  id: 'user-1',
  firstName: 'Lucía',
  lastName: 'Profesional',
  phone: '1122334455',
  avatarPath: null,
  role: 'professional',
  province: 'Buenos Aires',
  city: 'Lanús',
  onboardingCompleted: true,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

const professionalProfile: ProfessionalProfile = {
  id: 'professional-1',
  userId: 'user-1',
  bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
  yearsExperience: 8,
  baseCity: 'Lanús',
  baseLatitude: null,
  baseLongitude: null,
  serviceRadiusKm: 25,
  availabilityStatus: 'available',
  verificationStatus: 'pending',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

const categories: Category[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Electricidad',
    slug: 'electricidad',
    description: 'Instalaciones y reparaciones eléctricas.',
    active: true,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Albañilería y terminaciones',
    slug: 'albanileria',
    description: 'Arreglos y terminaciones del hogar.',
    active: true,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
];

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    sessionState: {
      status: 'authenticated',
      user: { id: 'user-1', email: 'pro@casaticket.local' },
      profile,
      professionalProfile,
      professionalCategoryIds: ['11111111-1111-4111-8111-111111111111'],
      error: null,
    },
    setProfileFromMutation: (...args: unknown[]) => mockSetProfileFromMutation(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  }),
}));

jest.mock('@/features/categories/api', () => ({
  listActiveCategories: (...args: unknown[]) => mockListActiveCategories(...args),
}));

jest.mock('@/features/profile/api', () => ({
  saveProfessionalOnboarding: (...args: unknown[]) => mockSaveProfessionalOnboarding(...args),
}));

jest.mock('@/features/profile/avatar-api', () => ({
  profileAvatarQueryKey: (path: string | null) => ['profile-avatar', path],
  resolveProfileAvatarUrl: (...args: unknown[]) => mockResolveProfileAvatarUrl(...args),
}));

import {
  ProfessionalCategoriesScreen,
  ProfessionalProfileHubScreen,
} from '@/features/professional/professional-profile-screens';

const activeQueryClients: QueryClient[] = [];

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Number.POSITIVE_INFINITY, retry: false },
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
  activeQueryClients.push(queryClient);
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('professional profile screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListActiveCategories.mockResolvedValue(categories);
    profile.avatarPath = null;
    mockResolveProfileAvatarUrl.mockResolvedValue('https://signed.local/profile.jpg');
    mockSaveProfessionalOnboarding.mockResolvedValue({
      profile,
      professionalProfile,
      categories: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });
  });

  afterEach(() => {
    cleanup();
    while (activeQueryClients.length > 0) {
      activeQueryClients.pop()?.clear();
    }
  });

  it('renders a profile hub without onboarding progress and opens its sections', async () => {
    renderWithQueryClient(<ProfessionalProfileHubScreen />);

    expect(screen.queryByText(/Paso 5 de 5/)).toBeNull();
    expect(screen.getByText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Rubros y especialidades')).toBeTruthy();
    expect(screen.getByText('Zona de trabajo')).toBeTruthy();
    expect(screen.getByText('Disponibilidad')).toBeTruthy();
    expect(screen.getByText('Descripción profesional')).toBeTruthy();
    expect(screen.getByText('Foto de perfil')).toBeTruthy();
    expect(screen.getByText('Portfolio')).toBeTruthy();
    expect(screen.getByText('Ver cómo me ven los clientes')).toBeTruthy();

    fireEvent.press(screen.getByText('Rubros y especialidades'));
    expect(mockPush).toHaveBeenCalledWith('/(professional)/profile/categories');

    fireEvent.press(screen.getByText('Ver cómo me ven los clientes'));
    expect(mockPush).toHaveBeenCalledWith('/professional/professional-1');
  });

  it('resolves and renders the saved avatar in the private profile header', async () => {
    profile.avatarPath = 'avatars/user-1/profile-123.jpg';
    renderWithQueryClient(<ProfessionalProfileHubScreen />);

    await waitFor(() => expect(mockResolveProfileAvatarUrl).toHaveBeenCalledWith(profile.avatarPath));
    await waitFor(() => expect(screen.getByLabelText('Foto de Lucía Profesional')).toBeTruthy());
  });

  it('searches, selects and saves professional categories', async () => {
    renderWithQueryClient(<ProfessionalCategoriesScreen />);

    await waitFor(() => expect(screen.getByText('Electricidad')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Buscar rubros'), 'albañilería');
    expect(screen.getByText('Albañilería y terminaciones')).toBeTruthy();
    expect(screen.queryByText('Electricidad')).toBeNull();

    fireEvent.press(screen.getByText('Albañilería y terminaciones'));
    expect(screen.getByText('2 rubros seleccionados')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar rubros'));

    await waitFor(() => {
      expect(mockSaveProfessionalOnboarding).toHaveBeenCalled();
    });
    expect(mockSaveProfessionalOnboarding.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        categoryIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      }),
    );
    expect(mockBack).toHaveBeenCalled();
  });
});
