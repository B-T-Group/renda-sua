import { ArrowBack as ArrowBackIcon, AccountBalance } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';

const BusinessAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accounts, loading, error, refetch } = useAccountInfo();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('accounts.businessPageSeoTitle', 'Business accounts')}
        description={t(
          'accounts.businessPageSeoDescription',
          'View balances, top up, withdraw, and transaction history for all your business accounts.'
        )}
        keywords={t('seo.business-dashboard.keywords')}
      />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
      >
        {t('business.dashboard.backToDashboard', 'Back to dashboard')}
      </Button>

      <Typography
        variant="h4"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <AccountBalance color="primary" />
        {t('accounts.accountInformation')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'accounts.businessPageSubtitle',
          'Balances, top-ups, withdrawals, and recent transactions for each account.'
        )}
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            {t('common.loading', 'Loading...')}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && accounts.length === 0 && (
        <Alert severity="info">
          {t('accounts.noAccounts', 'No accounts found')}
        </Alert>
      )}

      {!loading && accounts.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
            },
            gap: 3,
          }}
        >
          {accounts.map((account) => (
            <UserAccount
              key={account.id}
              accountId={account.id}
              compactView={false}
              showTransactions={true}
              onRefresh={refetch}
            />
          ))}
        </Box>
      )}
    </Container>
  );
};

export default BusinessAccountsPage;
