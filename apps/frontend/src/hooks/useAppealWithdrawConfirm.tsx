import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../components/common/ConfirmationModal';

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
    <ConfirmationModal
      open={open}
      title={t('business.items.recovery.resubmit.confirmTitle', 'Resubmit for review')}
      message={t(
        'business.items.recovery.appeal.withdrawWarn',
        'Resubmitting will withdraw your pending appeal.'
      )}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );

  return { confirmWithdraw, dialog };
}
