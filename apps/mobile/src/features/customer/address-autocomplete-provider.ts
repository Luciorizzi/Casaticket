import { supabase } from '@/lib/supabase';

export interface AddressSearchContext { city?: string; province?: string }
export interface AddressSuggestion { id: string; primaryText: string; secondaryText: string }
export interface ResolvedAddress {
  formattedAddress: string; street: string | null; streetNumber: string | null; city: string; province: string;
  postalCode: string | null; latitude: number | null; longitude: number | null; providerPlaceId: string;
}
export interface AddressAutocompleteProvider {
  readonly id: string;
  searchAddress(query: string, context?: AddressSearchContext): Promise<AddressSuggestion[]>;
  resolveAddress(providerPlaceId: string): Promise<ResolvedAddress>;
}

async function invokeAddressFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('address-autocomplete', { body });
  if (error) throw error;
  return data as T;
}

export const googlePlacesAddressProvider: AddressAutocompleteProvider = {
  id: 'google_places',
  searchAddress: async (query, context) => {
    const data = await invokeAddressFunction<{ suggestions: AddressSuggestion[] }>({ action: 'search', query, context });
    return data.suggestions.slice(0, 5);
  },
  resolveAddress: (providerPlaceId) => invokeAddressFunction<ResolvedAddress>({ action: 'resolve', providerPlaceId }),
};
