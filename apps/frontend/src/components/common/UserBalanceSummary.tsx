import { AccountBalance } from '@mui/icons-material';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

interface UserBalanceSummaryProps {
  compact?: boolean;
  showIcon?: boolean;
}

const UserBalanceSummary: React.FC<UserBalanceSummaryProps> = ({
  compact = true,
  showIcon = true,
}) => {
  const { t } = useTranslation();
  const { accounts, accountsLoading } = useUserProfileContext();

  // Filter accounts with balance > 0
  const accountsWithBalance = accounts.filter(
    (account) => account.total_balance > 0
  );

  // Show loading state
  if (accountsLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showIcon && <AccountBalance color="primary" />}
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          {t('common.loading', 'Loading...')}
        </Typography>
      </Box>
    );
  }

  // Don't show anything if no accounts with balance
  if (accountsWithBalance.length === 0) {
    return null;
  }

  // Format currency helper
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (compact) {
    // Show total balance across all accounts
    const totalBalance = accountsWithBalance.reduce(
      (total, account) => total + account.total_balance,
      0
    );

    // If all accounts have the same currency, show total
    const currencies = [
      ...new Set(accountsWithBalance.map((acc) => acc.currency)),
    ];

    if (currencies.length === 1) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showIcon && <AccountBalance color="primary" />}
          <Typography variant="body2" fontWeight="medium">
            {t('accounts.balance', 'Balance')}:{' '}
            {formatCurrency(totalBalance, currencies[0])}
          </Typography>
        </Box>
      );
    } else {
      // Multiple currencies - show each currency separately
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showIcon && <AccountBalance color="primary" />}
          <Typography variant="body2" fontWeight="medium">
            {t('accounts.balance', 'Balance')}:
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
            {currencies.map((currency) => {
              const currencyBalance = accountsWithBalance
                .filter((acc) => acc.currency === currency)
                .reduce((total, acc) => total + acc.total_balance, 0);

              return (
                <Chip
                  key={currency}
                  label={formatCurrency(currencyBalance, currency)}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', height: 20 }}
                />
              );
            })}
          </Stack>
        </Box>
      );
    }
  } else {
    // Non-compact view - show each account separately
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showIcon && <AccountBalance color="primary" />}
        <Typography variant="body2" fontWeight="medium">
          {t('accounts.balance', 'Balance')}:
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
          {accountsWithBalance.map((account) => (
            <Chip
              key={account.id}
              label={formatCurrency(account.total_balance, account.currency)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 20 }}
            />
          ))}
        </Stack>
      </Box>
    );
  }
};

export default UserBalanceSummary;
