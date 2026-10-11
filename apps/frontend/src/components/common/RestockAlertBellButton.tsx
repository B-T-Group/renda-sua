import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import {
  NotificationsActive,
  NotificationsNone,
  NotificationsOff,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useRestockAlerts } from '../../hooks/useRestockAlerts';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';
import {
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';

interface RestockAlertBellButtonProps {
  itemId: string;
  itemName: string;
  alertState: ItemAlertState;
  onAlertChange?: (newState: ItemAlertState) => void;
  size?: 'small' | 'medium';
}

export const RestockAlertBellButton: React.FC<RestockAlertBellButtonProps> = ({
  itemId,
  itemName,
  alertState,
  onAlertChange,
  size = 'medium',
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { setItemAlert } = useRestockAlerts();
  const [loading, setLoading] = useState(false);
  const trackSiteEvent = useTrackSiteEvent();

  const handleToggle = async () => {
    if (loading) return;

    const newEnabled = !alertState.enabled;
    const previousState = { ...alertState };

    setLoading(true);
    try {
      const result = await setItemAlert(itemId, newEnabled);

      const newState: ItemAlertState = {
        state: result.state as ItemAlertState['state'],
        enabled: result.enabled,
        expires_at: result.expires_at,
      };

      onAlertChange?.(newState);

      const message = newEnabled
        ? t('restock.alertOn', 'Alert on')
        : t('restock.alertOff.withUndo', 'Alert off · Undo');

      const snackbarKey = enqueueSnackbar(message, {
        variant: 'default',
        autoHideDuration: newEnabled ? 3000 : 5000,
        action: !newEnabled
          ? (key) => (
              <IconButton
                size="small"
                color="inherit"
                onClick={async () => {
                  closeSnackbar(key);
                  try {
                    const undoResult = await setItemAlert(itemId, true);
                    onAlertChange?.({
                      state: undoResult.state as ItemAlertState['state'],
                      enabled: undoResult.enabled,
                      expires_at: undoResult.expires_at,
                    });
                    enqueueSnackbar(t('restock.alertOn', 'Alert on'), {
                      variant: 'default',
                      autoHideDuration: 3000,
                    });
                  } catch {
                    enqueueSnackbar(t('common.error', 'Something went wrong'), {
                      variant: 'error',
                    });
                  }
                }}
              >
                {t('restock.undo', 'Undo')}
              </IconButton>
            )
          : undefined,
      });

      void trackSiteEvent({
        eventType: newEnabled ? 'restock.alert_opened' : 'restock.opt_out',
        subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
        subjectId: itemId,
        metadata: newEnabled ? { surface: 'bell' } : { surface: 'bell' },
      });
    } catch (error: any) {
      onAlertChange?.(previousState);
      enqueueSnackbar(
        error?.response?.data?.message || t('common.error', 'Something went wrong'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const renderBellIcon = () => {
    if (alertState.state === 'on') {
      return <NotificationsActive sx={{ color: 'primary.main' }} />;
    }
    if (alertState.state === 'expired') {
      return <NotificationsOff sx={{ color: 'text.disabled' }} />;
    }
    return <NotificationsNone sx={{ color: 'text.secondary' }} />;
  };

  const getAriaLabel = () => {
    const stateText = alertState.enabled
      ? t('restock.bellOn', 'on')
      : t('restock.bellOff', 'off');
    return t('restock.bellAriaLabel', 'Restock alert for {{item}}: {{state}}', {
      item: itemName,
      state: stateText,
    });
  };

  const getTooltip = () => {
    if (alertState.state === 'on') {
      return t('restock.bellTooltipOn', "We'll tell you when it's back");
    }
    if (alertState.state === 'expired') {
      return t('restock.bellTooltipExpired', 'Alert expired');
    }
    return t('restock.bellTooltipOff', "Notify me when it's back");
  };

  return (
    <Tooltip title={getTooltip()}>
      <IconButton
        size={size}
        onClick={handleToggle}
        disabled={loading}
        aria-label={getAriaLabel()}
      >
        {renderBellIcon()}
      </IconButton>
    </Tooltip>
  );
};
