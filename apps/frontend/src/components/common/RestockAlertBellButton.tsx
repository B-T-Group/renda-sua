import {
  NotificationsActive,
  NotificationsNone,
} from '@mui/icons-material';
import { Button, IconButton, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  alertStateFromResult,
  isAlertOn,
  useRestockAlertsApi,
} from '../../hooks/useRestockAlerts';
import type { ItemAlertState } from '../../hooks/useRestockAlerts';
import {
  SITE_EVENT_RESTOCK_OPT_OUT,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';

interface RestockAlertBellButtonProps {
  /** Catalog item id (`items.id` / `item_id`), NOT the listing (business_inventory) id. */
  itemId: string;
  itemName: string;
  alertState: ItemAlertState;
  onAlertChange?: (newState: ItemAlertState) => void;
  /**
   * Called instead of the PUT when the item is not liked yet (PDP): the parent likes
   * the item and arms the bell.
   */
  onTurnOn?: () => Promise<ItemAlertState | null>;
  size?: 'small' | 'medium';
}

export const RestockAlertBellButton: React.FC<RestockAlertBellButtonProps> = ({
  itemId,
  itemName,
  alertState,
  onAlertChange,
  onTurnOn,
  size = 'medium',
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { setItemAlert } = useRestockAlertsApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [loading, setLoading] = useState(false);

  const isOn = isAlertOn(alertState);

  const showError = (error?: any) =>
    enqueueSnackbar(
      error?.response?.data?.message ||
        t('common.error', 'Something went wrong'),
      { variant: 'error' }
    );

  const showAlertOn = () =>
    enqueueSnackbar(t('restock.alertOn', 'Alert on'), {
      variant: 'default',
      autoHideDuration: 3000,
    });

  const turnOn = async () => {
    const next = onTurnOn
      ? await onTurnOn()
      : alertStateFromResult(await setItemAlert(itemId, true));
    if (next) onAlertChange?.(next);
    return next;
  };

  const handleUndo = async (key: string | number) => {
    closeSnackbar(key);
    try {
      if (await turnOn()) showAlertOn();
    } catch (error) {
      showError(error);
    }
  };

  const showAlertOffToast = () => {
    // "Alert off · Undo": the Undo part is a real button inside the toast.
    const [offText, undoText] = t('restock.alertOff.withUndo', 'Alert off · Undo')
      .split('·')
      .map((part) => part.trim());
    const key = enqueueSnackbar(
      <span>
        {offText}
        {undoText ? (
          <>
            {' · '}
            <Button
              size="small"
              color="inherit"
              sx={{ minWidth: 0, p: 0, ml: 0.25, textDecoration: 'underline' }}
              onClick={() => void handleUndo(key)}
            >
              {undoText}
            </Button>
          </>
        ) : null}
      </span>,
      { variant: 'default', autoHideDuration: 6000 }
    );
  };

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isOn) {
        const result = await setItemAlert(itemId, false);
        onAlertChange?.(alertStateFromResult(result));
        showAlertOffToast();
        void trackSiteEvent({
          eventType: SITE_EVENT_RESTOCK_OPT_OUT,
          subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
          subjectId: itemId,
          metadata: { surface: 'bell' },
        });
      } else if (await turnOn()) {
        showAlertOn();
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  // Spec §5: on = filled bell; off = outline, muted; expired = outline.
  const icon = isOn ? (
    <NotificationsActive sx={{ color: 'primary.main' }} />
  ) : (
    <NotificationsNone
      sx={{
        color: alertState.state === 'expired' ? 'text.secondary' : 'text.disabled',
      }}
    />
  );

  const tooltip = isOn
    ? t('restock.bellTooltipOn', "We'll tell you when it's back")
    : t('restock.bellTooltipOff', "Notify me when it's back");

  const ariaLabel = t(
    'restock.bellAriaLabel',
    'Restock alert for {{item}}: {{state}}',
    {
      item: itemName,
      state: isOn ? t('restock.bellOn', 'on') : t('restock.bellOff', 'off'),
    }
  );

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          size={size}
          onClick={() => void handleToggle()}
          disabled={loading}
          aria-label={ariaLabel}
          aria-pressed={isOn}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};
