import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const component = (items: Array<{ longText: string; types: string[] }>, type: string) => items.find((item) => item.types.includes(type))?.longText ?? null;
interface GooglePrediction { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }
interface GoogleAutocompleteResponse { suggestions?: GooglePrediction[] }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return json({ error: 'Address provider is not configured.' }, 503);
  const body = await request.json();
  if (body.action === 'search') {
    const query = String(body.query ?? '').trim();
    if (query.length < 3) return json({ suggestions: [] });
    const context = body.context ?? {};
    const input = [query, context.city, context.province, 'Argentina'].filter(Boolean).join(', ');
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat' },
      body: JSON.stringify({ input, includedRegionCodes: ['ar'], languageCode: 'es', regionCode: 'AR' }),
    });
    if (!response.ok) return json({ error: 'Address search failed.' }, 502);
    const payload = await response.json() as GoogleAutocompleteResponse;
    const suggestions = (payload.suggestions ?? []).flatMap((item) => item.placePrediction ? [{
      id: item.placePrediction.placeId,
      primaryText: item.placePrediction.structuredFormat?.mainText?.text ?? '',
      secondaryText: item.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }] : []).slice(0, 5);
    return json({ suggestions });
  }
  if (body.action === 'resolve') {
    const placeId = encodeURIComponent(String(body.providerPlaceId ?? ''));
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=es&regionCode=AR`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location' },
    });
    if (!response.ok) return json({ error: 'Address resolution failed.' }, 502);
    const place = await response.json();
    const components = place.addressComponents ?? [];
    return json({ formattedAddress: place.formattedAddress, street: component(components, 'route'),
      streetNumber: component(components, 'street_number'), city: component(components, 'locality') ?? component(components, 'administrative_area_level_2') ?? '',
      province: component(components, 'administrative_area_level_1') ?? '', postalCode: component(components, 'postal_code'),
      latitude: place.location?.latitude ?? null, longitude: place.location?.longitude ?? null, providerPlaceId: place.id });
  }
  return json({ error: 'Unsupported action.' }, 400);
});
