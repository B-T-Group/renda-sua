import { AccountBalance, AccountBalanceWallet } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';
import { Account } from '../../hooks/useAccountInfo';

interface AccountInformationProps {
  accounts: Account[];
  onTopUpClick?: () => void;
  formatCurrency?: (amount: number, currency?: string) => string;
}

const defaultFormatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const AccountInformation: React.FC<AccountInformationProps> = ({
  accounts,
  onTopUpClick,
  formatCurrency = defaultFormatCurrency,
}) => {
  const handleTopUpClick = () => {
    if (onTopUpClick) {
      onTopUpClick();
    } else {
      // Default behavior: navigate to profile page
      window.location.href = '/profile';
    }
  };

  if (accounts.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <AccountBalance color="primary" />
        Account Information
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(auto-fit, minmax(300px, 1fr))',
          },
          gap: 2,
        }}
      >
        {accounts.map((account) => (
          <Card key={account.id} variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {account.currency} Account
              </Typography>
              <Typography variant="h4" color="primary" gutterBottom>
                {formatCurrency(account.total_balance, account.currency)}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Available:{' '}
                  {formatCurrency(account.available_balance, account.currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Withheld:{' '}
                  {formatCurrency(account.withheld_balance, account.currency)}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AccountBalanceWallet />}
                onClick={handleTopUpClick}
              >
                Top Up Account
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Paper>
  );
};

export default AccountInformation;
