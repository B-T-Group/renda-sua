import React from 'react';
import { useTranslation } from 'react-i18next';
import { Snackbar } from 'react-native-paper';
import type { RestockToastState } from '../../hooks/useRestockBellToggle';

export interface RestockToastProps {
  toast: RestockToastState;
  onUndo: () => void;
  onDismiss: () => void;
}

/** "Alert on" / "Alert off · Undo" (copy per #343 §6). */
export function RestockToast({ toast, onUndo, onDismiss }: RestockToastProps) {
  const { t } = useTranslation();
  let message = '';
  if (toast?.kind === 'on') message = t('restockAlerts.alertOn', 'Alert on');
  else if (toast?.kind === 'off') message = t('restockAlerts.alertOff', 'Alert off');
  else if (toast?.kind === 'error') {
    message = t('restockAlerts.toggleError', 'Could not update the alert. Try again.');
  }
  return (
    <Snackbar
      visible={toast != null}
      onDismiss={onDismiss}
      duration={5000}
      action={
        toast?.kind === 'off'
          ? { label: t('restockAlerts.undo', 'Undo'), onPress: onUndo }
          : undefined
      }
    >
      {message}
    </Snackbar>
  );
}
