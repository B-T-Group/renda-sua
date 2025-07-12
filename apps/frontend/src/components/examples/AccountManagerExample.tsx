import { Box, Container, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import AccountManager from '../common/AccountManager';

/**
 * Example component demonstrating how to use the AccountManager
 * for different entity types (agent, client, business)
 */
const AccountManagerExample: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();

  if (!profile) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Please log in to view account management examples
        </Typography>
      </Container>
    );
  }

  // Get the user ID for account fetching
  const userId = profile.id;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Account Manager Examples
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Examples of how to use the reusable AccountManager component for
            different entity types.
          </Typography>
        </Box>

        {/* Basic Usage */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Basic Usage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Default configuration with all features enabled
          </Typography>
          <AccountManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={userId}
          />
        </Box>

        {/* Compact View */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Compact View
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Compact view without detailed balance breakdown
          </Typography>
          <AccountManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={userId}
            title="Account Overview"
            compactView={true}
            showTotalSummary={false}
          />
        </Box>

        {/* Business-Specific Usage */}
        {profile.user_type_id === 'business' && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Business-Specific Usage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Business account management with transaction history
            </Typography>
            <AccountManager
              entityType="business"
              entityId={userId}
              title="Business Accounts"
              showTransactions={true}
              showTotalSummary={true}
              maxTransactions={15}
              emptyStateMessage="No business accounts configured yet."
            />
          </Box>
        )}

        {/* Agent-Specific Usage */}
        {profile.user_type_id === 'agent' && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Agent-Specific Usage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Agent account management with commission tracking
            </Typography>
            <AccountManager
              entityType="agent"
              entityId={userId}
              title="Agent Earnings"
              showTransactions={true}
              showTotalSummary={true}
              maxTransactions={20}
              emptyStateMessage="No agent accounts found."
            />
          </Box>
        )}

        {/* Client-Specific Usage */}
        {profile.user_type_id === 'client' && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Client-Specific Usage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Client account management with spending history
            </Typography>
            <AccountManager
              entityType="client"
              entityId={userId}
              title="My Wallet"
              showTransactions={true}
              showTotalSummary={true}
              maxTransactions={10}
              emptyStateMessage="No wallet accounts found."
            />
          </Box>
        )}

        {/* View-Only Usage */}
        <Box>
          <Typography variant="h5" gutterBottom>
            View-Only Usage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Account overview without transaction history
          </Typography>
          <AccountManager
            entityType={profile.user_type_id as 'agent' | 'client' | 'business'}
            entityId={userId}
            title="Account Summary"
            showTransactions={false}
            showTotalSummary={true}
            compactView={false}
            emptyStateMessage="No accounts available for viewing."
          />
        </Box>
      </Stack>
    </Container>
  );
};

export default AccountManagerExample;
