import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import { Box, Button } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthGate } from '../../contexts/AuthGateContext';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useAuthFunnelTracking } from '../../hooks/useAuthFunnelTracking';
import { useStockAvailabilityCheck } from '../../hooks/useStockAvailabilityCheck';
import { ItemDetailScarcityBadge } from './ItemDetailScarcityBadge';

/** Matches backend LOW_STOCK_THRESHOLD. */
const LOW_STOCK_MAX = 5;

type Props = {
  inventoryId: string;
  itemName: string;
  quantity: number;
};

export function ItemDetailAvailabilityCheck({
  inventoryId,
  itemName,
  quantity,
}: Props) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated } = useSessionAuth();
  const { flagOn, requireAuth } = useAuthGate();
  const { loginWithRedirectTracked } = useAuthFunnelTracking('item_detail');
  const { sending, pending, requestCheck } = useStockAvailabilityCheck(inventoryId);
  const queuedAfterAuth = useRef(false);
  const visible = quantity > 0 && quantity <= LOW_STOCK_MAX;

  const notify = useCallback(
    (result: { ok: boolean; message?: string }) => {
      const text = result.ok
        ? t(
            'items.availability.requestSent',
            'We’ve asked the store to confirm availability. You’ll be notified when they reply.'
          )
        : result.message ||
          t(
            'items.availability.requestFailed',
            'Could not send the availability check. Try again shortly.'
          );
      enqueueSnackbar(text, { variant: result.ok ? 'success' : 'error' });
    },
    [enqueueSnackbar, t]
  );

  const send = useCallback(async () => {
    const result = await requestCheck();
    if (result) notify(result);
  }, [notify, requestCheck]);

  useEffect(() => {
    if (!isAuthenticated || !queuedAfterAuth.current) return;
    queuedAfterAuth.current = false;
    void send();
  }, [isAuthenticated, send]);

  const promptSignIn = useCallback(() => {
    queuedAfterAuth.current = true;
    if (flagOn) {
      void requireAuth({
        context: 'generic',
        entry: 'item_availability_check',
        run: () => {
          queuedAfterAuth.current = true;
        },
      }).then((ok) => {
        if (!ok) queuedAfterAuth.current = false;
      });
      return;
    }
    void loginWithRedirectTracked('item_detail_availability', {
      appState: { returnTo: window.location.pathname },
    });
  }, [flagOn, loginWithRedirectTracked, requireAuth]);

  const onCheck = useCallback(() => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }
    void send();
  }, [isAuthenticated, promptSignIn, send]);

  if (!visible) return null;

  const label = pending
    ? t('items.availability.pending', 'Waiting for the store…')
    : t('items.availability.checkCta', 'Check availability with store');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
      }}
    >
      <ItemDetailScarcityBadge quantity={quantity} />
      <Button
        variant="text"
        size="small"
        color="warning"
        startIcon={<StorefrontOutlined />}
        loading={sending}
        disabled={pending || sending}
        onClick={onCheck}
        aria-label={t(
          'items.availability.checkCtaA11y',
          'Check availability of {{name}} with the store',
          { name: itemName }
        )}
      >
        {label}
      </Button>
    </Box>
  );
}
