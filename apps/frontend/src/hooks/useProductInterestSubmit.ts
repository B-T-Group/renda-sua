import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invalidateExportOrderLookup } from './useExportOrderForInventory';
import { useExportOrders } from './useExportOrders';
import { useMarket } from './useMarket';
import {
  useProductInterest,
  type ProductInterestResult,
  type ProductInterestSource,
} from './useProductInterest';

interface Options {
  open: boolean;
  businessInventoryId: string;
  onLeadSent: () => void;
  /** 'public_export_catalog' = partner inquiry from /exports/{cc}: always a lead. */
  source?: ProductInterestSource;
  /** Market to send when the selected market is not known yet. */
  fallbackCountryCode?: string | null;
}

export function useProductInterestSubmit({
  open,
  businessInventoryId,
  onLeadSent,
  source = 'in_app',
  fallbackCountryCode,
}: Options) {
  const partner = source === 'public_export_catalog';
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedMarket } = useMarket();
  const { submitInterest } = useProductInterest();
  const { getEnabled } = useExportOrders();
  const countryCode = selectedMarket?.countryCode ?? fallbackCountryCode ?? undefined;
  const [orderMode, setOrderMode] = useState(false);
  const [placed, setPlaced] = useState<ProductInterestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let stop = false;
    setPlaced(null);
    setOrderMode(false);
    // Partner inquiries never open an export order.
    if (partner) return undefined;
    getEnabled(countryCode)
      .then((enabled) => !stop && setOrderMode(enabled))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [open, countryCode, getEnabled, partner]);

  const submit = useCallback(
    async (note: string) => {
      setSubmitting(true);
      try {
        const result = await submitInterest(businessInventoryId, note, countryCode, source);
        if (result?.export_order) {
          setPlaced(result);
          invalidateExportOrderLookup();
          const bc = result.bc_number || '';
          enqueueSnackbar(
            t('productInterest.order.snackbar', 'Export request {{bc}} received.', { bc }),
            { variant: 'success' }
          );
          return;
        }
        onLeadSent();
        enqueueSnackbar(
          t('productInterest.success', 'Interest sent. The seller will contact you.'),
          { variant: 'success' }
        );
      } catch (e: any) {
        enqueueSnackbar(
          e?.response?.data?.message || t('productInterest.error', 'Could not send interest'),
          { variant: 'error' }
        );
      } finally {
        setSubmitting(false);
      }
    },
    [businessInventoryId, countryCode, enqueueSnackbar, onLeadSent, source, submitInterest, t]
  );

  return { orderMode, placed, submitting, submit };
}
