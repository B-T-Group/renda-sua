/** Capture stubs for web data hooks. Not imported by the app. */
import { dashboardPayload, listPayload } from './fixtures';

const flags = { rentals_dashboard_requests_enabled: true };
const profile = { business: { id: 'biz-atelier' }, accounts: [] as unknown[] };

const fetchDashboardRentalRequests = async () => dashboardPayload();
const fetchBusinessRentalRequests = async () => listPayload();
const respondRequest = async () => ({ success: true });

export function useClientFlags() {
  return { flags, loaded: true, loading: false, error: null };
}

export function useUserProfileContext() {
  return { profile };
}

export function useRentalApi() {
  return { fetchDashboardRentalRequests, fetchBusinessRentalRequests, respondRequest };
}

export function useApiClient() {
  return { post: async () => ({}), get: async () => ({}) };
}

export function useTrackSiteEvent() {
  return () => undefined;
}

export const SITE_EVENT_ASSISTANT_RENTAL_PRICE_CHANGED = 'assistant.rental.price_changed_shown';
