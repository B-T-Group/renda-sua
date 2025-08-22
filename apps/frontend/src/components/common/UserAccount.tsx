import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountById } from '../../hooks/useAccountInfo';
import { useAirtelMoney } from '../../hooks/useAirtelMoney';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';
import WithdrawModal from '../business/WithdrawModal';

interface UserAccountProps {
  accountId: string;
  compactView?: boolean;
  showTransactions?: boolean;
  onRefresh?: (() => Promise<void>) | (() => void);
}

const UserAccount: React.FC<UserAccountProps> = ({
  accountId,
  compactView = false,
  showTransactions = true,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { userProfile } = useProfile();

  // Use the new hook to fetch account data
  const { account, loading, error, subscriptionFailed, refetch } =
    useAccountById(accountId);

  // Modal states
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  // Confirmation message states
  const [showTopUpSuccess, setShowTopUpSuccess] = useState(false);
  const [showWithdrawSuccess, setShowWithdrawSuccess] = useState(false);

  // Hooks for payment operations
  const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();
  const { initiatePayment, loading: mobilePaymentsLoading } =
    useMobilePayments();
  const { loading: airtelLoading } = useAirtelMoney();

  // If account is still loading or not found, show loading state
  if (loading || !account) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight={100}
        >
          <Typography variant="body2" color="text.secondary">
            {loading ? t('common.loading') : t('accounts.accountNotFound')}
          </Typography>
        </Box>
      </Card>
    );
  }

  // If there's an error, show error state
  if (error) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight={100}
        >
          <Typography variant="body2" color="error">
            {t('common.error')}:{' '}
            {typeof error === 'string' ? error : error.message}
          </Typography>
        </Box>
      </Card>
    );
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleViewTransactions = () => {
    setTransactionDialogOpen(true);
  };

  const handleTopUp = () => {
    setTopUpModalOpen(true);
  };

  const handleWithdraw = () => {
    setWithdrawModalOpen(true);
  };

  const handleTopUpConfirm = async (
    phoneNumber: string,
    amount: string,
    paymentMethod: any
  ): Promise<boolean> => {
    try {
      // Use initiatePayment for Airtel and MOOV, requestTopUp for MTN MoMo
      if (paymentMethod === 'airtel-money' || paymentMethod === 'moov-money') {
        const provider = paymentMethod === 'airtel-money' ? 'airtel' : 'moov';
        await initiatePayment({
          amount: parseFloat(amount),
          currency: account.currency,
          description: 'Account Top Up',
          customerPhone: phoneNumber,
          accountId: account.id,
          provider,
          paymentMethod: 'mobile_money',
          transactionType: 'PAYMENT',
        });
      } else {
        // Use requestTopUp for MTN MoMo
        await requestTopUp({
          amount,
          phoneNumber,
          currency: account.currency,
        });
      }
      setShowTopUpSuccess(true);
      return true;
    } catch (error) {
      console.error('Top up failed:', error);
      return false;
    }
  };

  const handleWithdrawConfirm = async (
    phoneNumber: string,
    amount: string,
    paymentMethod: any
  ): Promise<boolean> => {
    try {
      await initiatePayment({
        amount: parseFloat(amount),
        currency: account.currency,
        description: 'Withdrawal',
        customerPhone: phoneNumber,
        accountId: account.id,
        transactionType: 'GIVE_CHANGE',
      });
      setShowWithdrawSuccess(true);
      return true;
    } catch (error) {
      console.error('Withdrawal failed:', error);
      return false;
    }
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6" color="primary">
                  {account.currency} {t('accounts.account')}
                </Typography>
                <Chip
                  label={
                    account.is_active
                      ? t('common.active')
                      : t('common.inactive')
                  }
                  color={account.is_active ? 'success' : 'default'}
                  size="small"
                />
                {!subscriptionFailed && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'success.main',
                      marginLeft: 1,
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                        '100%': { opacity: 1 },
                      },
                    }}
                    title="Real-time updates active"
                  />
                )}
              </Box>
              <Typography variant="h4" color="primary" gutterBottom>
                {formatCurrency(account.total_balance, account.currency)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={1}
            >
              <Typography variant="body2" color="text.secondary">
                {t('accounts.available')}:
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatCurrency(account.available_balance, account.currency)}
              </Typography>
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="body2" color="text.secondary">
                {t('accounts.withheld')}:
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatCurrency(account.withheld_balance, account.currency)}
              </Typography>
            </Box>
          </Box>

          {showTransactions && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                width: '100%',
                alignItems: 'flex-end',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <IconButton
                  onClick={handleViewTransactions}
                  disabled={loading}
                  title={t('accounts.viewTransactions')}
                >
                  <VisibilityIcon />
                </IconButton>
              </Box>
              <Button
                onClick={handleTopUp}
                disabled={loading}
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                sx={{
                  width: '150px',
                  background:
                    'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                  color: 'white',
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
                  '&:hover': {
                    background:
                      'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)',
                    boxShadow: '0 4px 8px 2px rgba(76, 175, 80, .4)',
                  },
                  '&:disabled': {
                    background:
                      'linear-gradient(45deg, #9E9E9E 30%, #BDBDBD 90%)',
                    boxShadow: 'none',
                  },
                }}
              >
                {t('accounts.creditAccount')}
              </Button>
              {account.available_balance > 0 && (
                <Button
                  onClick={handleWithdraw}
                  disabled={loading}
                  variant="contained"
                  size="small"
                  startIcon={<RemoveIcon />}
                  sx={{
                    width: '150px',
                    background:
                      'linear-gradient(45deg, #FF5722 30%, #FF7043 90%)',
                    color: 'white',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: '0 3px 5px 2px rgba(255, 87, 34, .3)',
                    '&:hover': {
                      background:
                        'linear-gradient(45deg, #D84315 30%, #FF5722 90%)',
                      boxShadow: '0 4px 8px 2px rgba(255, 87, 34, .4)',
                    },
                    '&:disabled': {
                      background:
                        'linear-gradient(45deg, #9E9E9E 30%, #BDBDBD 90%)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {t('accounts.withdraw')}
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Top Up Modal */}
      <TopUpModal
        open={topUpModalOpen}
        onClose={() => setTopUpModalOpen(false)}
        userPhoneNumber={userProfile?.phone_number || ''}
        currency={account.currency}
        loading={topUpLoading || airtelLoading || mobilePaymentsLoading}
        onConfirm={handleTopUpConfirm}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        open={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        userPhoneNumber={userProfile?.phone_number || ''}
        currency={account.currency}
        availableBalance={account.available_balance}
        loading={mobilePaymentsLoading}
        onConfirm={handleWithdrawConfirm}
      />

      {/* Success Messages */}
      <Snackbar
        open={showTopUpSuccess}
        autoHideDuration={6000}
        onClose={() => setShowTopUpSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowTopUpSuccess(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {t('accounts.topUpSuccess')}
        </Alert>
      </Snackbar>

      <Snackbar
        open={showWithdrawSuccess}
        autoHideDuration={6000}
        onClose={() => setShowWithdrawSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowWithdrawSuccess(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {t('accounts.withdrawSuccess')}
        </Alert>
      </Snackbar>

      {/* Transaction History Dialog - Placeholder for now */}
      {/* This would need to be implemented with a proper transaction dialog component */}
    </>
  );
};

export default UserAccount;
