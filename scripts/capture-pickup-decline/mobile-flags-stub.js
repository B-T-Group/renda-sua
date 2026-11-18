import React from 'react';

export function ClientFlagsProvider({ children }) {
  return children;
}

export function useClientFlags() {
  return {
    flags: { rentals_pickup_decline_enabled: true },
    loading: false,
    refresh: async () => undefined,
  };
}
