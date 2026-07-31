const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));

import { googlePlacesAddressProvider } from '@/features/customer/address-autocomplete-provider';

describe('Google Places address provider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches through the authenticated edge function with location context', async () => {
    const suggestions = [{ id: 'place-1', primaryText: 'Salguero 2247', secondaryText: 'Palermo, CABA' }];
    mockInvoke.mockResolvedValue({ data: { suggestions }, error: null });
    await expect(googlePlacesAddressProvider.searchAddress('Salguero', { city: 'CABA' })).resolves.toEqual(suggestions);
    expect(mockInvoke).toHaveBeenCalledWith('address-autocomplete', { body: expect.objectContaining({ action: 'search', query: 'Salguero' }) });
  });

  it('resolves structured address data without exposing a provider key', async () => {
    const address = { formattedAddress: 'Salguero 2247, CABA', street: 'Salguero', streetNumber: '2247', city: 'CABA', province: 'CABA', postalCode: null, latitude: -34, longitude: -58, providerPlaceId: 'place-1' };
    mockInvoke.mockResolvedValue({ data: address, error: null });
    await expect(googlePlacesAddressProvider.resolveAddress('place-1')).resolves.toEqual(address);
  });
});
