import { AccountBalanceWallet, EventAvailable } from '@mui/icons-material';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  isLegacyWalletAccount,
  useUserProfileContext,
} from '../../contexts/UserProfileContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useReferralProjectedPayout } from '../../hooks/useReferralProjectedPayout';
import { ReferralSaturdayPayoutIllustration } from '../illustrations/ReferralSaturdayPayoutIllustration';

const XAF = 'XAF';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || XAF,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

interface ReferralPayoutSnapshotProps {
  source: 'agent' | 'business';
  walletPath: string;
}

const ReferralPayoutSnapshot: React.FC<ReferralPayoutSnapshotProps> = ({
  source,
  walletPath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accounts, profile } = useUserProfileContext();
  const { isStripeRail } = useIsStripeRail();
  const { projection } = useReferralProjectedPayout(source, true);
  const projectedAmount = projection?.projectedAmount ?? 0;
  const payoutCurrency = projection?.currency ?? XAF;
  const walletCurrency =
    pickCurrency(accounts, isStripeRail, profile?.currency) ?? payoutCurrency;
  const available = pickAvailableBalance(
    accounts,
    isStripeRail,
    profile?.currency
  );
  if (projectedAmount <= 0) return null;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        background: (theme) =>
          `linear-gradient(120deg, ${theme.palette.success.main}14, ${theme.palette.primary.main}10)`,
      }}
    >
      <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ReferralSaturdayPayoutIllustration />
          </Box>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('referrals.projectedPayout.title', 'Saturday payout')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'referrals.projectedPayout.hint',
                'Approved referrals awaiting this week’s payout.'
              )}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ pt: 0.5 }}
            >
              <AmountBlock
                icon={<AccountBalanceWallet fontSize="small" color="primary" />}
                label={t('referrals.projectedPayout.available', 'Available')}
                value={formatMoney(available, walletCurrency)}
              />
              <AmountBlock
                icon={<EventAvailable fontSize="small" color="success" />}
                label={t(
                  'referrals.projectedPayout.expected',
                  'Expected this Saturday'
                )}
                value={formatMoney(projectedAmount, payoutCurrency)}
                emphasize
              />
            </Stack>
          </Stack>
          <Button
            variant="contained"
            onClick={() => navigate(walletPath)}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, whiteSpace: 'nowrap' }}
          >
            {t('referrals.projectedPayout.wallet', 'Wallet')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

function AmountBlock({
  icon,
  label,
  value,
  emphasize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
      <Typography
        variant={emphasize ? 'h6' : 'subtitle1'}
        fontWeight={700}
        color={emphasize ? 'success.main' : 'text.primary'}
      >
        {value}
      </Typography>
    </Box>
  );
}

function pickAvailableBalance(
  accounts: { business_location_id?: string | null; currency: string; available_balance: number }[],
  isStripeRail: boolean,
  preferredCurrency?: string | null
): number {
  const wallet = pickWallet(accounts, isStripeRail, preferredCurrency);
  return wallet?.available_balance ?? 0;
}

function pickCurrency(
  accounts: { business_location_id?: string | null; currency: string }[],
  isStripeRail: boolean,
  preferredCurrency?: string | null
): string | undefined {
  return pickWallet(accounts, isStripeRail, preferredCurrency)?.currency;
}

function pickWallet<
  T extends { business_location_id?: string | null; currency: string }
>(accounts: T[], isStripeRail: boolean, preferredCurrency?: string | null): T | undefined {
  const legacy = accounts.filter(isLegacyWalletAccount);
  const preferred = preferredCurrency?.trim().toUpperCase();
  if (preferred) {
    const match = legacy.find((a) => a.currency === preferred);
    if (match) return match;
  }
  if (isStripeRail) {
    return legacy.find((a) => a.currency !== XAF) ?? legacy[0];
  }
  return legacy.find((a) => a.currency === XAF) ?? legacy[0];
}

export default ReferralPayoutSnapshot;
