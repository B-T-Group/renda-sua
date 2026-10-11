import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RestockAlertBellButton } from './RestockAlertBellButton';
import { useRestockAlerts } from '../../hooks/useRestockAlerts';
import { useItemLike } from '../../hooks/useItemLike';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import {
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';

interface RestockAlertPdpSectionProps {
  inventoryItem: InventoryItem;
  isClientUser: boolean;
  hasStock: boolean;
}

export const RestockAlertPdpSection: React.FC<RestockAlertPdpSectionProps> = ({
  inventoryItem,
  isClientUser,
  hasStock,
}) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { enabled: restockEnabled, setItemAlert } = useRestockAlerts();
  const { isLiked, toggleLike } = useItemLike(inventoryItem.id, inventoryItem.liked ?? false);
  const trackSiteEvent = useTrackSiteEvent();

  const [alertState, setAlertState] = useState<ItemAlertState | null>(null);
  const [loading, setLoading] = useState(false);

  const src = searchParams.get('src');
  const isRestockAlert = src === 'restock_alert';

  useEffect(() => {
    if (!restockEnabled || !inventoryItem.restock_alert) return;
    setAlertState(inventoryItem.restock_alert);
  }, [restockEnabled, inventoryItem.restock_alert]);

  useEffect(() => {
    if (isRestockAlert && hasStock) {
      void trackSiteEvent({
        eventType: 'restock.alert_opened',
        subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
        subjectId: inventoryItem.id,
        metadata: { surface: 'pdp', has_stock: true },
      });
    }
  }, [isRestockAlert, hasStock]);

  if (!isClientUser || !restockEnabled || hasStock) {
    return null;
  }

  const handleBellToggle = async (enabled: boolean) => {
    if (!isLiked) {
      setLoading(true);
      try {
        await toggleLike();
        const result = await setItemAlert(inventoryItem.id, enabled);
        setAlertState({
          state: result.state as ItemAlertState['state'],
          enabled: result.enabled,
          expires_at: result.expires_at,
        });
      } catch {
        enqueueSnackbar(t('common.error', 'Something went wrong'), {
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  if (isRestockAlert && !hasStock) {
    return (
      <Alert
        severity="info"
        sx={{ mt: 2 }}
        action={
          <Button
            size="small"
            color="inherit"
            onClick={() => navigate(`/items?search=${encodeURIComponent(inventoryItem.item.name || '')}`)}
          >
            {t('restock.browseMore', 'Browse similar')}
          </Button>
        }
      >
        {t('restock.goneAgainBanner', "Gone again. We'll tell you next time.")}
      </Alert>
    );
  }

  if (!isLiked || !alertState) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <RestockAlertBellButton
          itemId={inventoryItem.id}
          itemName={inventoryItem.item.name || ''}
          alertState={alertState}
          onAlertChange={setAlertState}
        />
        <Typography variant="body2" color="text.secondary">
          {alertState.state === 'on'
            ? t('restock.bellTooltipOn', "We'll tell you when it's back")
            : t('restock.bellTooltipOff', "Notify me when it's back")}
        </Typography>
      </Stack>
    </Box>
  );
};
