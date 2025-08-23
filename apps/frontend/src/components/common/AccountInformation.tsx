import { AccountBalance } from '@mui/icons-material';
import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import React from 'react';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import UserAccount from './UserAccount';

interface AccountInformationProps {
  onRefresh?: (() => Promise<void>) | (() => void);
  compactView?: boolean;
  showTransactions?: boolean;
}

const AccountInformation: React.FC<AccountInformationProps> = ({
  onRefresh,
  compactView = true,
  showTransactions = true,
}) => {
  const { accounts, loading: accountLoading, refetch } = useAccountInfo();

  // Use internal refetch if no external onRefresh provided
  const handleRefresh = onRefresh || refetch;

  // Show loading state
  if (accountLoading) {
    return (
      <Paper sx={{ p: 3, mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading account information...
        </Typography>
      </Paper>
    );
  }

  // Don't render if no accounts
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
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          width: '100%',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-start' },
          alignItems: { xs: 'center', sm: 'flex-start' },
        }}
      >
        {accounts.map((account) => (
          <Box
            key={account.id}
            sx={{
              width: { xs: '100%', sm: '24rem' }, // Full width on mobile, fixed width on larger screens
              minWidth: { xs: '100%', sm: '24rem' },
              maxWidth: { xs: '100%', sm: '24rem' },
            }}
          >
            <UserAccount
              accountId={account.id}
              compactView={compactView}
              showTransactions={showTransactions}
              onRefresh={handleRefresh}
            />
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default AccountInformation;
