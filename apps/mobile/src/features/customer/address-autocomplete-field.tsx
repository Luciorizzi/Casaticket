import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import type { AddressAutocompleteProvider, AddressSearchContext, ResolvedAddress } from './address-autocomplete-provider';

export function AddressAutocompleteField({ context, onChangeText, onSelect, provider, selected, value }: {
  context?: AddressSearchContext;
  onChangeText: (value: string) => void;
  onSelect: (address: ResolvedAddress) => void;
  provider: AddressAutocompleteProvider;
  selected: boolean;
  value: string;
}) {
  const [results, setResults] = useState<Array<{ id: string; primaryText: string; secondaryText: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const contextCity = context?.city;
  const contextProvince = context?.province;

  useEffect(() => {
    if (selected || value.trim().length < 3) { setResults([]); setLoading(false); return; }
    let active = true;
    setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const searchContext = { ...(contextCity ? { city: contextCity } : {}), ...(contextProvince ? { province: contextProvince } : {}) };
      void provider.searchAddress(value, searchContext).then((next) => { if (active) setResults(next); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [contextCity, contextProvince, provider, selected, value]);

  return <View style={styles.stack}>
    <TextInput onChangeText={onChangeText} placeholder="Escribí calle y altura" value={value} />
    {loading ? <Text style={styles.meta}>Buscando direcciones...</Text> : null}
    {error ? <Text style={styles.error}>No pudimos buscar direcciones. Reintentá.</Text> : null}
    {!selected && !loading && !error && value.trim().length >= 3 && results.length === 0 ? <Text style={styles.meta}>No encontramos sugerencias.</Text> : null}
    {selected ? <Text style={styles.selected}>Dirección seleccionada</Text> : null}
    {results.map((result) => <Pressable accessibilityRole="button" key={result.id} onPress={() => { setLoading(true); void provider.resolveAddress(result.id).then(onSelect).catch(() => setError(true)).finally(() => setLoading(false)); setResults([]); }} style={styles.result}>
      <Text style={styles.title}>{result.primaryText}</Text>
      <Text style={styles.meta}>{result.secondaryText}</Text>
    </Pressable>)}
    <Text style={styles.note}>Resultados proporcionados por Google Maps.</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 8 }, result: { minHeight: 52, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' }, meta: { color: colors.muted, fontSize: 13 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17 }, error: { color: colors.danger, fontSize: 13 },
  selected: { color: colors.success, fontSize: 13, fontWeight: '600' },
});
