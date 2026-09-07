import { useCallback, useState } from 'react';
import { createBooking } from '../services/rentalsApi';
import type {
  CreateRentalBookingOptions,
  CreateRentalBookingResult,
} from '../types/rentals';

export function useBookRental() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = useCallback(
    async (
      rentalRequestId: string,
      options?: CreateRentalBookingOptions
    ): Promise<CreateRentalBookingResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await createBooking({
          rentalRequestId,
          stripe_payment_method: options?.stripe_payment_method,
        });
        if (!res.success) {
          throw new Error('Failed to create booking');
        }
        return res;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create booking';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { book, loading, error };
}
