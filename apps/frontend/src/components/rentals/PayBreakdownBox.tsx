import { AccessTime, AccountBalanceWallet, Check, CreditCard, PhoneIphone, ShieldOutlined } from '@mui/icons-material';
import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PayBreakdown, PayBreakdownRow } from '../../utils/rentals/payBreakdown';

const ICONS: Record<PayBreakdownRow['icon'], React.ReactElement> = {
  clock: <AccessTime fontSize="small" color="action" />,
  check: <Check fontSize="small" color="action" />,
  card: <CreditCard fontSize="small" color="action" />,
  momo: <PhoneIphone fontSize="small" color="action" />,
  wallet: <AccountBalanceWallet fontSize="small" color="action" />,
  shield: <ShieldOutlined fontSize="small" color="action" />,
};

/** Approved 05a/05b rows: rental, reservation fee paid, charged / to pay now, deposit hold. */
export function PayBreakdownBox({ breakdown }: { breakdown: PayBreakdown }) {
  const { t } = useTranslation();
  return (
    <Box data-testid="pay-breakdown" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, mt: 1.5 }}>
      {breakdown.rows.map((row, i) => (
        <Stack
          key={row.key}
          data-testid={`pay-breakdown-${row.key}`}
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: 1.5, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}
        >
          {ICONS[row.icon]}
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{row.label}</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" fontWeight={row.strong ? 800 : 700}>{row.value}</Typography>
            {row.sub ? <Typography variant="caption" color="text.secondary" display="block">{row.sub}</Typography> : null}
          </Box>
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 1, display: 'block', borderTop: 1, borderColor: 'divider' }}>
        {t('rentals.commission.clientNoFees', 'No Rendasua service fee for renters. The price you see is the price you pay.')}
      </Typography>
    </Box>
  );
}

export function PayFooter({ breakdown }: { breakdown: PayBreakdown }) {
  if (!breakdown.footer) return null;
  return (
    <Typography data-testid="pay-breakdown-footer" variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 0.75 }}>
      {breakdown.footer}
    </Typography>
  );
}
