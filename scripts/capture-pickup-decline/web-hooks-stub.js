export function useApiClient() {
  return {
    get: async () => ({ data: { data: {} } }),
    post: async () => ({ data: {} }),
  };
}

export function useClientFlags() {
  return { flags: { rentals_pickup_decline_enabled: true }, loaded: true };
}

export function useRentalApi() {
  return { fetchConditionPhotos: async () => ({ photos: [] }) };
}
