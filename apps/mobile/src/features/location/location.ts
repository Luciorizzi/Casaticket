const CABA_ALIASES = new Set([
  'caba',
  'capital_federal',
  'ciudad_autonoma_de_buenos_aires',
]);

function normalizedToken(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function normalizeCity(value: string | null | undefined): string {
  const token = normalizedToken(value ?? '');
  return CABA_ALIASES.has(token) ? 'ciudad_autonoma_de_buenos_aires' : token;
}

export function getCityDisplayName(value: string | null | undefined): string {
  const normalized = normalizeCity(value);
  if (normalized === 'ciudad_autonoma_de_buenos_aires') return 'Ciudad Autónoma de Buenos Aires';
  return value?.trim() || '';
}

export function formatLocation(city: string | null | undefined, province: string | null | undefined): string {
  const cityLabel = getCityDisplayName(city);
  const provinceLabel = province?.trim() ?? '';
  if (cityLabel && provinceLabel) return `${cityLabel}, ${provinceLabel}`;
  return cityLabel || provinceLabel || 'Ubicación no informada';
}
