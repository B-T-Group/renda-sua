import { useCallback, useEffect, useState } from 'react';
import { getClientBookings } from '../services/rentalsApi';
import type { ClientRentalBookingRow } from '../types/rentals';

export function useClientRentalBookings(enabled = true) {
  const [bookings, setBookings] = useState<ClientRentalBookingRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getClientBookings();
      setBookings(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { bookings, loading, error, refetch };
}
