export interface CityOption {
  label: string;
  value: string;
  aliases: string[];
}

export const BUENOS_AIRES_CITY_OPTIONS = [
  {
    label: 'CABA',
    value: 'caba',
    aliases: [
      'caba',
      'ciudad autonoma de buenos aires',
      'ciudad autónoma de buenos aires',
      'capital federal',
    ],
  },
  { label: 'Avellaneda', value: 'avellaneda', aliases: ['avellaneda'] },
  { label: 'Lanús', value: 'lanus', aliases: ['lanus', 'lanús'] },
  { label: 'Lomas de Zamora', value: 'lomas-de-zamora', aliases: ['lomas de zamora'] },
  { label: 'Quilmes', value: 'quilmes', aliases: ['quilmes'] },
  { label: 'Almirante Brown', value: 'almirante-brown', aliases: ['almirante brown'] },
  { label: 'La Matanza', value: 'la-matanza', aliases: ['la matanza'] },
  { label: 'Morón', value: 'moron', aliases: ['moron', 'morón'] },
  { label: 'Tres de Febrero', value: 'tres-de-febrero', aliases: ['tres de febrero'] },
  { label: 'San Martín', value: 'san-martin', aliases: ['san martin', 'san martín'] },
  { label: 'Vicente López', value: 'vicente-lopez', aliases: ['vicente lopez', 'vicente lópez'] },
  { label: 'San Isidro', value: 'san-isidro', aliases: ['san isidro'] },
  { label: 'Tigre', value: 'tigre', aliases: ['tigre'] },
  { label: 'San Fernando', value: 'san-fernando', aliases: ['san fernando'] },
  { label: 'Escobar', value: 'escobar', aliases: ['escobar'] },
  { label: 'Pilar', value: 'pilar', aliases: ['pilar'] },
  { label: 'Moreno', value: 'moreno', aliases: ['moreno'] },
  { label: 'Merlo', value: 'merlo', aliases: ['merlo'] },
  { label: 'Ituzaingó', value: 'ituzaingo', aliases: ['ituzaingo', 'ituzaingó'] },
  { label: 'Hurlingham', value: 'hurlingham', aliases: ['hurlingham'] },
  { label: 'Ezeiza', value: 'ezeiza', aliases: ['ezeiza'] },
  { label: 'Esteban Echeverría', value: 'esteban-echeverria', aliases: ['esteban echeverria', 'esteban echeverría'] },
  { label: 'Florencio Varela', value: 'florencio-varela', aliases: ['florencio varela'] },
  { label: 'Berazategui', value: 'berazategui', aliases: ['berazategui'] },
  { label: 'La Plata', value: 'la-plata', aliases: ['la plata'] },
  { label: 'Mar del Plata', value: 'mar-del-plata', aliases: ['mar del plata'] },
  { label: 'Bahía Blanca', value: 'bahia-blanca', aliases: ['bahia blanca', 'bahía blanca'] },
  { label: 'Tandil', value: 'tandil', aliases: ['tandil'] },
  { label: 'Olavarría', value: 'olavarria', aliases: ['olavarria', 'olavarría'] },
  { label: 'Junín', value: 'junin', aliases: ['junin', 'junín'] },
] as const satisfies readonly CityOption[];

export function normalizeCityName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getCityFilterValue(city: string): string {
  const normalizedCity = normalizeCityName(city);
  const catalogOption = BUENOS_AIRES_CITY_OPTIONS.find((option) =>
    option.aliases.some((alias) => normalizeCityName(alias) === normalizedCity),
  );

  return catalogOption?.value ?? normalizedCity;
}
