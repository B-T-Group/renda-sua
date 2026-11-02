import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmActionDialog } from '../components/dialogs/ConfirmActionDialog';

export function useAppealWithdrawConfirm() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<(ok: boolean) => void>();

  const finish = useCallback((ok: boolean) => {
    setOpen(false);
    resolveRef.current?.(ok);
  }, []);

  const confirmWithdraw = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const dialog = (
    <ConfirmActionDialog
      visible={open}
      title={t('business.items.recovery.resubmit.confirmTitle', 'Resubmit for review')}
      message={t(
        'business.items.recovery.appeal.withdrawWarn',
        'Resubmitting will withdraw your pending appeal.'
      )}
      cancelLabel={t('common.cancel', 'Cancel')}
      confirmLabel={t('common.confirm', 'Confirm')}
      onDismiss={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { confirmWithdraw, dialog };
}
