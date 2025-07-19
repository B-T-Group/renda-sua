import { City, Country, State } from 'country-state-city';

export interface ParsedAddress {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface GooglePlaceResult {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
}

export function parseGooglePlaceResult(
  place: GooglePlaceResult
): ParsedAddress {
  const addressComponents = place.address_components || [];
  const geometry = place.geometry;

  // Initialize result
  const result: ParsedAddress = {
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    latitude: geometry?.location?.lat(),
    longitude: geometry?.location?.lng(),
  };

  // Extract address components
  const streetNumber =
    addressComponents.find((component) =>
      component.types.includes('street_number')
    )?.long_name || '';

  const route =
    addressComponents.find((component) => component.types.includes('route'))
      ?.long_name || '';

  const subpremise =
    addressComponents.find((component) =>
      component.types.includes('subpremise')
    )?.long_name || '';

  const locality =
    addressComponents.find((component) => component.types.includes('locality'))
      ?.long_name || '';

  const administrativeAreaLevel1 = addressComponents.find((component) =>
    component.types.includes('administrative_area_level_1')
  );

  const postalCode =
    addressComponents.find((component) =>
      component.types.includes('postal_code')
    )?.long_name || '';

  const country = addressComponents.find((component) =>
    component.types.includes('country')
  );

  // Build address line 1
  if (streetNumber && route) {
    result.address_line_1 = `${streetNumber} ${route}`;
  } else if (route) {
    result.address_line_1 = route;
  }

  // Build address line 2
  if (subpremise) {
    result.address_line_2 = subpremise;
  }

  // Set city
  result.city = locality;

  // Set postal code
  result.postal_code = postalCode;

  // Convert country name to ISO code
  if (country) {
    const countryCode = convertCountryNameToCode(country.long_name);
    result.country = countryCode;

    // Convert state name to ISO code
    if (administrativeAreaLevel1) {
      const stateCode = convertStateNameToCode(
        administrativeAreaLevel1.long_name,
        countryCode
      );
      result.state = stateCode;
    }
  }

  return result;
}

function convertCountryNameToCode(countryName: string): string {
  const countries = Country.getAllCountries();
  const country = countries.find(
    (c) =>
      c.name.toLowerCase() === countryName.toLowerCase() ||
      c.isoCode.toLowerCase() === countryName.toLowerCase()
  );
  return country?.isoCode || countryName;
}

function convertStateNameToCode(
  stateName: string,
  countryCode: string
): string {
  const states = State.getStatesOfCountry(countryCode);
  const state = states.find(
    (s) =>
      s.name.toLowerCase() === stateName.toLowerCase() ||
      s.isoCode.toLowerCase() === stateName.toLowerCase()
  );
  return state?.isoCode || stateName;
}

function convertCityNameToCode(
  cityName: string,
  countryCode: string,
  stateCode: string
): string {
  const cities = City.getCitiesOfState(countryCode, stateCode);
  const city = cities.find(
    (c) => c.name.toLowerCase() === cityName.toLowerCase()
  );
  return city?.name || cityName;
}
