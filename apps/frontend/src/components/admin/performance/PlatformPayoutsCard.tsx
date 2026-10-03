import { Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PlatformPayoutRow } from '../../../hooks/useAdminPerformance';
import { formatPayoutMoney } from '../AdminPayoutPreviewTable';

interface PlatformPayoutsCardProps {
  payouts: PlatformPayoutRow[];
  emptyLabel: string;
}

export const PlatformPayoutsCard: React.FC<PlatformPayoutsCardProps> = ({
  payouts,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600}>
          {t('admin.performance.platform.payoutsTitle', 'Payouts')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            'admin.performance.platform.payoutsHelp',
            'Money credited from orders and referrals in this period, by recipient.'
          )}
        </Typography>
        {payouts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {payouts.map((row) => (
              <PayoutCurrencyRow key={row.currency} row={row} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const PayoutCurrencyRow: React.FC<{ row: PlatformPayoutRow }> = ({ row }) => {
  const { t } = useTranslation();
  const lines = payoutLines(row);
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {row.currency}
      </Typography>
      <Stack spacing={0.5}>
        {lines.map((line) => (
          <PayoutLine
            key={line.field}
            label={t(line.labelKey, line.label)}
            tip={t(line.tipKey, line.tip)}
            value={formatPayoutMoney(line.amount, row.currency)}
          />
        ))}
      </Stack>
    </Box>
  );
};

function payoutLines(row: PlatformPayoutRow) {
  return [
    line(row, 'platformRevenue', 'Platform revenue', 'HQ share of item and delivery commissions.'),
    line(row, 'agentDeliveryPay', 'Agent delivery pay', 'Delivery fees credited to agents.'),
    line(row, 'partnerCommissions', 'Partner commissions', 'Partner share of commissions.'),
    line(row, 'merchantPayouts', 'Merchant payouts', 'Order value credited to businesses.'),
    line(
      row,
      'referralCompensation',
      'Referral compensation',
      'Credited representative compensation and referral bonuses.'
    ),
    line(
      row,
      'platformFundedDelivery',
      'Funded delivery',
      'HQ cost of paying the agent when the delivery fee was waived.'
    ),
  ];
}

function line(
  row: PlatformPayoutRow,
  field: Exclude<keyof PlatformPayoutRow, 'currency'>,
  label: string,
  tip: string
) {
  return {
    field,
    amount: row[field],
    labelKey: `admin.performance.platform.${field}`,
    label,
    tipKey: `admin.performance.platform.${field}Tip`,
    tip,
  };
}

const PayoutLine: React.FC<{ label: string; tip: string; value: string }> = ({
  label,
  tip,
  value,
}) => (
  <Stack direction="row" justifyContent="space-between" spacing={2}>
    <Tooltip title={tip}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Tooltip>
    <Typography variant="body2" fontWeight={700}>
      {value}
    </Typography>
  </Stack>
);
