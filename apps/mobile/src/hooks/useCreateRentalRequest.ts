import { useCallback, useState } from 'react';
import { createRequest } from '../services/rentalsApi';
import type {
  CreateRentalRequestBody,
  CreateRentalRequestResult,
} from '../types/rentals';

export function useCreateRentalRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (body: CreateRentalRequestBody): Promise<CreateRentalRequestResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await createRequest(body);
        if (!res.success) {
          throw new Error('Failed to create rental request');
        }
        return res;
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Failed to create rental request';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { submit, loading, error };
}
