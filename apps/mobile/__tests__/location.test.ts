import { formatLocation, getCityDisplayName, normalizeCity } from '@/features/location/location';

describe('location normalization', () => {
  it.each(['CABA', 'Ciudad Autónoma de Buenos Aires', 'Ciudad Autonoma de Buenos Aires', 'Capital Federal'])(
    'normalizes %s to the same internal value',
    (value) => expect(normalizeCity(value)).toBe('ciudad_autonoma_de_buenos_aires'),
  );

  it('uses the preferred CABA display name', () => expect(getCityDisplayName('CABA')).toBe('Ciudad Autónoma de Buenos Aires'));

  it('formats incomplete locations without empty separators', () => {
    expect(formatLocation('Lanús', null)).toBe('Lanús');
    expect(formatLocation(null, 'Buenos Aires')).toBe('Buenos Aires');
    expect(formatLocation(null, null)).toBe('Ubicación no informada');
  });
});
