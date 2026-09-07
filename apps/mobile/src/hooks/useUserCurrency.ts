import { useProfileMe } from './useProfileMe';

const DEFAULT_CURRENCY = 'XAF';

export function useUserCurrency(enabled = true) {
  const { me, loading } = useProfileMe(enabled);

  return {
    country: me?.country ?? null,
    currency: me?.currency ?? null,
    loading,
  };
}

export function resolveDisplayCurrency(
  ...candidates: Array<string | null | undefined>
): string {
  for (const value of candidates) {
    if (value?.trim()) return value.trim().toUpperCase();
  }
  return DEFAULT_CURRENCY;
}
