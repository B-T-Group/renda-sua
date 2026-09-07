import { api } from './apiClient';
import { publicApiGet } from './publicApiClient';
import type { GeocodeApiResult, PlacePrediction } from '../types/googleMapsApi';

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeApiResult | null> {
  const path = `/google/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
  // Try authenticated first (faster path for logged-in users); fall back to public for signup.
  try {
    const res = await api.get<{
      success: boolean;
      result?: GeocodeApiResult;
      error?: string;
    }>(path);
    if (res?.success && res.result) return res.result;
  } catch {
    // Fall through to public path
  }
  const res = await publicApiGet<{ success: boolean; result?: GeocodeApiResult; error?: string }>(path);
  if (!res?.success || !res.result) return null;
  return res.result;
}

export async function fetchPlacePredictions(input: string, country?: string): Promise<PlacePrediction[]> {
  const q = new URLSearchParams({ input: input.trim() });
  if (country && country.trim().length === 2) {
    q.set('country', country.trim().toUpperCase());
  }
  const res = await api.get<{
    success: boolean;
    predictions?: PlacePrediction[];
  }>(`/google/places-autocomplete?${q.toString()}`);
  if (!res?.success || !Array.isArray(res.predictions)) return [];
  return res.predictions;
}

export async function fetchPlaceDetails(placeId: string): Promise<GeocodeApiResult | null> {
  const res = await api.get<{
    success: boolean;
    result?: GeocodeApiResult;
    error?: string;
  }>(`/google/place-details?place_id=${encodeURIComponent(placeId)}`);
  if (!res?.success || !res.result) return null;
  return res.result;
}
