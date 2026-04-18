/** Normalize Google Places result into AddressForm fields (ISO country, long names for state/city). */
export function parseGooglePlaceAddress(place: google.maps.places.PlaceResult): {
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
} {
  const comps = place.address_components ?? [];
  const get = (type: string, short = false): string => {
    const c = comps.find((x) => x.types.includes(type));
    if (!c) return '';
    return short ? c.short_name : c.long_name;
  };

  const streetNumber = get('street_number');
  const route = get('route');
  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim();
  const city =
    get('locality') ||
    get('administrative_area_level_2') ||
    get('sublocality') ||
    get('sublocality_level_1') ||
    '';
  const state = get('administrative_area_level_1');
  const postal = get('postal_code');
  const country = (get('country', true) || '').toUpperCase();

  const loc = place.geometry?.location;
  const latitude = loc ? loc.lat() : undefined;
  const longitude = loc ? loc.lng() : undefined;

  const fallbackLine1 =
    place.formatted_address?.split(',')[0]?.trim() ?? '';

  return {
    address_line_1: line1 || fallbackLine1,
    city,
    state,
    postal_code: postal,
    country,
    latitude,
    longitude,
  };
}
