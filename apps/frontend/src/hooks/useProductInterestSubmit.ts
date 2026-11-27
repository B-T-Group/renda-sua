import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportOrders } from './useExportOrders';
import { useMarket } from './useMarket';
import { useProductInterest, type ProductInterestResult } from './useProductInterest';

interface Options {
  open: boolean;
  businessInventoryId: string;
  onLeadSent: () => void;
}

export function useProductInterestSubmit({ open, businessInventoryId, onLeadSent }: Options) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedMarket } = useMarket();
  const { submitInterest } = useProductInterest();
  const { getEnabled } = useExportOrders();
  const countryCode = selectedMarket?.countryCode;
  const [orderMode, setOrderMode] = useState(false);
  const [placed, setPlaced] = useState<ProductInterestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let stop = false;
    setPlaced(null);
    setOrderMode(false);
    getEnabled(countryCode)
      .then((enabled) => !stop && setOrderMode(enabled))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [open, countryCode, getEnabled]);

  const submit = useCallback(
    async (note: string) => {
      setSubmitting(true);
      try {
        const result = await submitInterest(businessInventoryId, note, countryCode);
        if (result?.export_order) {
          setPlaced(result);
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
    [businessInventoryId, countryCode, enqueueSnackbar, onLeadSent, submitInterest, t]
  );

  return { orderMode, placed, submitting, submit };
}
