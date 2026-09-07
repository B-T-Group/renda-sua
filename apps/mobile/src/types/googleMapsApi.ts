/** Structured address from Nest `/google/geocode` or `/google/place-details`. */
export interface GeocodeApiResult {
  formatted_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  address_line_1?: string;
  country_code?: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
}
