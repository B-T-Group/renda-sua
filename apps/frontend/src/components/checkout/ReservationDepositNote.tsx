import { Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ReservationDepositNoteProps {
  minimumApplied?: boolean;
  percent?: number | null;
}

export const ReservationDepositNote: React.FC<ReservationDepositNoteProps> = ({
  minimumApplied = false,
  percent = null,
}) => {
  const { t } = useTranslation();
  const detail = depositDetail(t, minimumApplied, percent);

  return (
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
      {detail} {t('deposit.appliedToTotal', 'Applied to your order — not an extra fee')}{' '}
      {t(
        'deposit.refundableUntilSent',
        'Refundable until we send it for delivery, or until it is ready for pickup'
      )}
    </Typography>
  );
};

function depositDetail(
  t: (key: string, defaultValue: string, options?: { percentage: number }) => string,
  minimumApplied: boolean,
  percent: number | null
): string {
  if (minimumApplied) {
    return t('deposit.minimumLabel', 'Minimum deposit for this order');
  }
  if (percent != null) {
    return t(
      'deposit.percentageLabel',
      '{{percentage}}% of items that require a deposit',
      { percentage: percent }
    );
  }
  return t(
    'deposit.mixedItemsLabel',
    'Deposit on items this store requires a deposit for'
  );
}
