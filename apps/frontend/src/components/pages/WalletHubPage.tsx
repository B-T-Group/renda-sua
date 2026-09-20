import { Button, Container, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import AccountManager from '../common/AccountManager';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

export default function WalletHubPage() {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const persona = profile?.active_persona || 'client';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts.walletHub.title', 'Wallet')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'accounts.walletHub.subtitle',
          'Spendable balance, cash advances, and purchase credits live here.'
        )}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 3 }}>
        <Button component={RouterLink} to="/accounts/cash-advance" variant="contained">
          {t('accounts.cashAdvance.title', 'Cash advance')}
        </Button>
        <Button component={RouterLink} to="/accounts/credits" variant="outlined">
          {t('accounts.purchaseCredits.title', 'Purchase credits')}
        </Button>
        {persona === 'agent' && (
          <Button component={RouterLink} to="/accounts/schedules" variant="outlined">
            {t('accounts.schedules.title', 'Payment schedules')}
          </Button>
        )}
      </Stack>
      {profile?.id && (
        <AccountManager
          entityType={
            profile.active_persona === 'agent' || profile.active_persona === 'business'
              ? profile.active_persona
              : 'client'
          }
          entityId={profile.id}
          showTransactions
          maxTransactions={8}
        />
      )}
    </Container>
  );
}
