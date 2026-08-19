import { Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PayoutPreviewRow } from '../../hooks/useAdminPerformance';

export function formatPayoutMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function payoutSkipLabel(
  t: (key: string, def: string) => string,
  reason: PayoutPreviewRow['skipReason']
): string {
  if (reason === 'no_referrer') {
    return t('admin.performance.payoutPreview.skipNoReferrer', 'No referrer');
  }
  if (reason === 'no_amount') {
    return t('admin.performance.payoutPreview.skipNoAmount', 'No amount');
  }
  if (reason === 'no_account') {
    return t('admin.performance.payoutPreview.skipNoAccount', 'Missing wallet');
  }
  return '';
}

export const AdminPayoutPreviewTable: React.FC<{ rows: PayoutPreviewRow[] }> = ({
  rows,
}) => {
  const { t } = useTranslation();
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>
            {t('admin.performance.payoutPreview.colBusiness', 'Business')}
          </TableCell>
          <TableCell>
            {t('admin.performance.payoutPreview.colReferrer', 'Referrer')}
          </TableCell>
          <TableCell align="right">
            {t('admin.performance.payoutPreview.colGross', 'Gross')}
          </TableCell>
          <TableCell>
            {t('admin.performance.payoutPreview.colPyramid', 'Who gets paid')}
          </TableCell>
          <TableCell>
            {t('admin.performance.payoutPreview.colStatus', 'Status')}
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <PreviewRow key={row.referredBusinessId} row={row} />
        ))}
      </TableBody>
    </Table>
  );
};

const PreviewRow: React.FC<{ row: PayoutPreviewRow }> = ({ row }) => {
  const { t } = useTranslation();
  const kindLabel =
    row.referralKind === 'agent'
      ? t('admin.performance.payoutPreview.kindAgent', 'Agent')
      : t('admin.performance.payoutPreview.kindBusiness', 'Business');
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {row.referredBusinessName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(
            'admin.performance.payoutPreview.itemsCount',
            '{{n}} approved items',
            { n: row.itemCount }
          )}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {row.referrer?.name ?? '—'} ({kindLabel})
        </Typography>
      </TableCell>
      <TableCell align="right">
        {row.grossAmount > 0
          ? formatPayoutMoney(row.grossAmount, row.currency)
          : '—'}
      </TableCell>
      <TableCell>
        {row.beneficiaries.map((b) => (
          <Typography
            key={`${b.generation}-${b.id}`}
            variant="caption"
            display="block"
          >
            {t(
              'admin.performance.payoutPreview.shareLine',
              'L{{gen}} {{name}}: {{amount}}{{wallet}}',
              {
                gen: b.generation,
                name: b.name,
                amount: formatPayoutMoney(b.amount, row.currency),
                wallet: b.hasAccount
                  ? ''
                  : t('admin.performance.payoutPreview.noWallet', ' (no wallet)'),
              }
            )}
          </Typography>
        ))}
      </TableCell>
      <TableCell>
        {row.pendingRetry && row.wouldCredit ? (
          <Chip
            size="small"
            color="info"
            label={t(
              'admin.performance.payoutPreview.pendingRetry',
              'Pending retry'
            )}
          />
        ) : row.wouldCredit ? (
          <Chip
            size="small"
            color="success"
            label={t('admin.performance.payoutPreview.willPay', 'Will pay')}
          />
        ) : (
          <Chip
            size="small"
            color="warning"
            label={payoutSkipLabel(t, row.skipReason)}
          />
        )}
      </TableCell>
    </TableRow>
  );
};
