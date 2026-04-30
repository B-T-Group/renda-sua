import { useCallback, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';

export type DiscountCodeValidationResult = {
  valid: boolean;
  discountPercentage: number;
  message: string;
};

export function useDiscountCode() {
  const apiClient = useApiClient();
  const [appliedCode, setAppliedCode] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCode = useCallback(
    async (code: string): Promise<DiscountCodeValidationResult> => {
      const trimmed = code.trim();
      if (!trimmed) {
        const res = { valid: false, discountPercentage: 0, message: 'Code required' };
        setError(res.message);
        return res;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get('/orders/discount-codes/validate', {
          params: { code: trimmed },
        });
        const data = response.data as DiscountCodeValidationResult;
        if (!data?.valid) {
          setAppliedCode('');
          setDiscountPercentage(0);
          setError(data?.message || 'Invalid discount code');
          return {
            valid: false,
            discountPercentage: 0,
            message: data?.message || 'Invalid discount code',
          };
        }

        setAppliedCode(trimmed);
        setDiscountPercentage(data.discountPercentage || 0);
        return {
          valid: true,
          discountPercentage: data.discountPercentage || 0,
          message: data?.message || 'Discount code is valid',
        };
      } catch (e: any) {
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Failed to validate discount code';
        setAppliedCode('');
        setDiscountPercentage(0);
        setError(message);
        return { valid: false, discountPercentage: 0, message };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const clear = useCallback(() => {
    setAppliedCode('');
    setDiscountPercentage(0);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      appliedCode,
      discountPercentage,
      loading,
      error,
      applyCode,
      clear,
    }),
    [appliedCode, discountPercentage, loading, error, applyCode, clear]
  );
}

