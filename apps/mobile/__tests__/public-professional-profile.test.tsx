import type { CustomerRequestApplication } from '@casaticket/types';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
const mockListPortfolio = jest.fn();
const mockListReviews = jest.fn();
const mockListAttachments = jest.fn();
const activeClients: QueryClient[] = [];

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/features/professional/public-profile-api', () => ({
  getPublicProfessionalProfile: (...args: unknown[]) => mockGetProfile(...args),
  listProfessionalPortfolio: (...args: unknown[]) => mockListPortfolio(...args),
  listPublicProfessionalReviews: (...args: unknown[]) => mockListReviews(...args),
}));
jest.mock('@/features/attachments/api', () => ({
  listAttachments: (...args: unknown[]) => mockListAttachments(...args),
}));

import { PublicProfessionalProfileScreen } from '@/features/professional/public-profile-screen';

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY, retry: false } } });
  activeClients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

function application(): CustomerRequestApplication {
  return {
    id: 'application-1', requestId: 'request-1', professionalId: 'professional-1', status: 'submitted',
    message: 'Puedo resolver el trabajo esta semana.', proposalType: 'direct_service', visitPrice: 5000,
    estimatedPrice: 30000, estimatedDurationText: 'Un día', availabilityText: 'Martes',
    createdAt: '2026-07-30T12:00:00Z', conversationId: null, unreadCount: 0, lastMessageBody: null,
    lastMessageAt: null, professionalFirstName: 'Juan', professionalLastName: 'Pérez', professionalBio: 'Bio',
    professionalYearsExperience: 8, professionalBaseCity: 'Lanús', professionalServiceRadiusKm: 25,
    professionalVerificationStatus: 'verified', professionalCategoryNames: ['Electricidad'],
    professionalCompletedJobsCount: 4, professionalAverageRating: 5, professionalReviewsCount: 1,
  };
}

describe('public professional profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      id: 'professional-1', userId: 'private-user-id', firstName: 'Juan', lastName: 'Pérez', avatarUrl: null,
      baseCity: 'Lanús', bio: 'Electricista matriculado con experiencia residencial.', yearsExperience: 8,
      serviceRadiusKm: 25, availabilityStatus: 'available', verificationStatus: 'verified',
      categoryNames: ['Electricidad'], completedJobsCount: 4, averageRating: 5, reviewsCount: 1,
    });
    mockListPortfolio.mockResolvedValue([]);
    mockListReviews.mockResolvedValue([{ id: 'review-1', rating: 5, comment: 'Excelente trabajo.', createdAt: '2026-07-29T12:00:00Z', customerName: 'A. C.' }]);
    mockListAttachments.mockResolvedValue([]);
  });
  afterEach(() => {
    cleanup();
    while (activeClients.length > 0) activeClients.pop()?.clear();
  });

  it('shows identity, reputation and real reviews without private data', async () => {
    renderWithClient(<PublicProfessionalProfileScreen professionalId="professional-1" />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());
    expect(screen.getByText('★ 5.0')).toBeTruthy();
    expect(screen.getByText('Excelente trabajo.')).toBeTruthy();
    expect(screen.queryByText('private-user-id')).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText(/teléfono/i)).toBeNull();
  });

  it('shows contextual proposal only when application is provided', async () => {
    const { rerender } = renderWithClient(<PublicProfessionalProfileScreen professionalId="professional-1" />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());
    expect(screen.queryByText('Propuesta para tu solicitud')).toBeNull();
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY, retry: false } } });
    activeClients.push(client);
    rerender(<QueryClientProvider client={client}><PublicProfessionalProfileScreen application={application()} professionalId="professional-1" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Propuesta para tu solicitud')).toBeTruthy());
    expect(screen.getByText('Puedo resolver el trabajo esta semana.')).toBeTruthy();
  });

  it('shows the empty reputation state without inventing a rating', async () => {
    mockGetProfile.mockResolvedValueOnce({ ...(await mockGetProfile()), averageRating: null, reviewsCount: 0 });
    mockListReviews.mockResolvedValueOnce([]);
    renderWithClient(<PublicProfessionalProfileScreen professionalId="professional-1" />);
    await waitFor(() => expect(screen.getByText('Este profesional todavía no tiene calificaciones.')).toBeTruthy());
    expect(screen.getByText('—')).toBeTruthy();
  });
});
