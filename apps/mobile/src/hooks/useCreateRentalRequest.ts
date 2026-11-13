import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRequest } from '../services/rentalsApi';
import { cardWindowErrorMessage } from '../utils/rentals/cardWindow';
import type {
  CreateRentalRequestBody,
  CreateRentalRequestResult,
} from '../types/rentals';

export function useCreateRentalRequest() {
  const { i18n } = useTranslation();
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
          cardWindowErrorMessage(e, i18n.language) ??
          (e instanceof Error ? e.message : 'Failed to create rental request');
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [i18n.language]
  );

  return { submit, loading, error };
}
