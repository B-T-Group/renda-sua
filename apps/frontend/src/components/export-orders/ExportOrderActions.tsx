import { Button, Stack, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

type BalanceOption = 'FULL' | 'FINANCED_30' | 'FINANCED_60';

interface ExportOrderActionsProps {
  status: string;
  busy: boolean;
  onApprove: () => void;
  onRequestAdjustment: (notes: string) => void;
  onBalanceOption: (option: BalanceOption) => void;
  onConfirmDelivery: () => void;
}

export const ExportOrderActions: React.FC<ExportOrderActionsProps> = ({
  status,
  busy,
  onApprove,
  onRequestAdjustment,
  onBalanceOption,
  onConfirmDelivery,
}) => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');

  if (status === 'PROFORMA_ISSUED') {
    return (
      <Stack spacing={2}>
        <TextField
          label={t('exportOrders.notes', 'Notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={busy} onClick={onApprove}>
            {t('exportOrders.approveProforma', 'Approve proforma')}
          </Button>
          <Button disabled={busy} onClick={() => onRequestAdjustment(notes)}>
            {t('exportOrders.requestAdjustment', 'Request adjustment')}
          </Button>
        </Stack>
      </Stack>
    );
  }
  if (status === 'BALANCE_REQUIRED') {
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => onBalanceOption('FULL')}
        >
          {t('exportOrders.payFull', 'Pay in full')}
        </Button>
        <Button disabled={busy} onClick={() => onBalanceOption('FINANCED_30')}>
          {t('exportOrders.finance30', 'Finance 30 days')}
        </Button>
        <Button disabled={busy} onClick={() => onBalanceOption('FINANCED_60')}>
          {t('exportOrders.finance60', 'Finance 60 days')}
        </Button>
      </Stack>
    );
  }
  if (status === 'SHIPPED') {
    return (
      <Button variant="contained" disabled={busy} onClick={onConfirmDelivery}>
        {t('exportOrders.confirmDelivery', 'Confirm delivery')}
      </Button>
    );
  }
  return null;
};
