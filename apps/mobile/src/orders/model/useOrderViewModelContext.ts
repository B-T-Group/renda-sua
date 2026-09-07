import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderViewModelContext } from './types';

export function useOrderViewModelContext(): OrderViewModelContext {
  const { t, i18n } = useTranslation();
  return useMemo(
    () => ({
      t: (key, defaultValue, options) =>
        String(t(key, { defaultValue: defaultValue ?? key, ...options })),
      now: new Date(),
      locale: i18n.language || 'en',
    }),
    [t, i18n.language]
  );
}
