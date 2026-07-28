import type { CustomerAddress, Profile } from '@casaticket/types';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSignOut = jest.fn();
const mockSetProfile = jest.fn();
const mockFetchAddress = jest.fn();
const mockSave = jest.fn();

jest.mock('expo-router', () => ({ router: { back: (...args: unknown[]) => mockBack(...args), push: (...args: unknown[]) => mockPush(...args) } }));

const profile: Profile = {
  avatarPath: null, city: 'Lanús', createdAt: '2026-07-16T00:00:00Z', firstName: 'Ana', id: 'user-1',
  lastName: 'Cliente', onboardingCompleted: true, phone: '1112345678', province: 'Buenos Aires',
  role: 'customer', updatedAt: '2026-07-16T00:00:00Z',
};
const address: CustomerAddress = {
  addressLine: 'Calle 123', city: 'Lanús', createdAt: '2026-07-16T00:00:00Z', customerId: 'user-1',
  id: 'address-1', isDefault: true, label: 'Casa', latitude: null, longitude: null,
  postalCode: null, province: 'Buenos Aires', updatedAt: '2026-07-16T00:00:00Z',
};

jest.mock('@/features/auth/auth-provider', () => ({ useAuthSession: () => ({
  sessionState: { error: null, professionalCategoryIds: [], professionalProfile: null, profile, status: 'authenticated', user: { email: 'ana@example.com', id: 'user-1' } },
  setProfileFromMutation: (...args: unknown[]) => mockSetProfile(...args), signOut: (...args: unknown[]) => mockSignOut(...args),
}) }));
jest.mock('@/features/profile/api', () => ({
  fetchOwnDefaultAddress: (...args: unknown[]) => mockFetchAddress(...args),
  saveCustomerOnboarding: (...args: unknown[]) => mockSave(...args),
}));

import { CustomerLocationScreen, CustomerPersonalDetailsScreen, CustomerProfileHubScreen } from '@/features/customer/customer-profile-screens';
import { queryKeys } from '@/lib/query-keys';

const clients: QueryClient[] = [];
function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Number.POSITIVE_INFINITY, retry: false }, queries: { gcTime: Number.POSITIVE_INFINITY, retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return client;
}

describe('customer profile screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAddress.mockResolvedValue(address);
    mockSave.mockResolvedValue({ ...profile, firstName: 'María' });
  });
  afterEach(() => { cleanup(); while (clients.length) clients.pop()?.clear(); });

  it('renders a profile hub instead of the long form and opens both sections', async () => {
    renderWithClient(<CustomerProfileHubScreen />);
    expect(screen.getByText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Ubicación')).toBeTruthy();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
    fireEvent.press(screen.getByText('Datos personales'));
    expect(mockPush).toHaveBeenCalledWith('/(customer)/profile/personal');
    fireEvent.press(screen.getByText('Ubicación'));
    expect(mockPush).toHaveBeenCalledWith('/(customer)/profile/location');
    await waitFor(() => expect(screen.getByText(/Calle 123/)).toBeTruthy());
  });

  it('saves personal data and updates profile cache and session UI state', async () => {
    const client = renderWithClient(<CustomerPersonalDetailsScreen />);
    fireEvent.changeText(screen.getByDisplayValue('Ana'), 'María');
    fireEvent.press(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(screen.getByText('Cambios guardados correctamente.')).toBeTruthy());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'María' }));
    expect(mockSetProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'María' }));
    expect(client.getQueryData(queryKeys.profile('user-1'))).toEqual(expect.objectContaining({ firstName: 'María' }));
  });

  it('saves location, refreshes address cache and uses real back navigation', async () => {
    const updatedAddress = { ...address, addressLine: 'Avenida 456', city: 'Avellaneda' };
    mockFetchAddress.mockResolvedValueOnce(address).mockResolvedValueOnce(updatedAddress);
    const client = renderWithClient(<CustomerLocationScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Calle 123')).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue('Calle 123'), 'Avenida 456');
    fireEvent.press(screen.getByText('Guardar ubicación'));
    await waitFor(() => expect(screen.getByText('Cambios guardados correctamente.')).toBeTruthy());
    expect(client.getQueryData(queryKeys.customerAddress('user-1'))).toEqual(updatedAddress);
    fireEvent.press(screen.getByText('Volver'));
    expect(mockBack).toHaveBeenCalled();
  });
});
