import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../hooks/useAccountManager';
import { useAirtelMoney } from '../../hooks/useAirtelMoney';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';
import WithdrawModal from '../business/WithdrawModal';

interface UserAccountProps {
  account: Account;
  loading?: boolean;
  compactView?: boolean;
  showTransactions?: boolean;
  onRefresh?: (() => Promise<void>) | (() => void);
}

const UserAccount: React.FC<UserAccountProps> = ({
  account,
  loading = false,
  compactView = false,
  showTransactions = true,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { userProfile } = useProfile();

  // Modal states
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Hooks for payment operations
  const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();
  const { initiatePayment, loading: mobilePaymentsLoading } =
    useMobilePayments();
  const { loading: airtelLoading } = useAirtelMoney();

  // Format currency amount
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date, formatType: 'PPP' | 'PPp' = 'PPP') => {
    if (formatType === 'PPP') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (formatType === 'PPp') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString();
  };

  // Handle view transactions
  const handleViewTransactions = async () => {
    setSelectedAccount(account);
    setTransactionDialogOpen(true);
    await fetchAccountTransactions();
  };

  // Handle top-up
  const handleTopUp = () => {
    setTopUpModalOpen(true);
  };

  // Handle withdraw
  const handleWithdraw = () => {
    setWithdrawModalOpen(true);
  };

  // Fetch account transactions
  const fetchAccountTransactions = async () => {
    setTransactionsLoading(true);
    try {
      // This would typically call an API to fetch transactions
      // For now, we'll use a placeholder
      setTransactions([]);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Handle top-up confirmation
  const handleTopUpConfirm = async (
    phoneNumber: string,
    amount: string,
    paymentMethod: 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card'
  ): Promise<boolean> => {
    try {
      let success = false;

      if (paymentMethod === 'mtn-momo') {
        success = await requestTopUp({
          phoneNumber,
          amount,
          currency: account.currency,
        });
      } else if (
        paymentMethod === 'airtel-money' ||
        paymentMethod === 'moov-money'
      ) {
        // Use the unified mobile payments API for Airtel Money and MOOV
        const provider = paymentMethod === 'airtel-money' ? 'airtel' : 'moov';

        const response = await initiatePayment({
          amount: parseFloat(amount),
          currency: account.currency,
          description: 'Account Top Up',
          customerPhone: phoneNumber,
          accountId: account.id,
          provider,
          paymentMethod: 'mobile_money',
        });

        success = response.success;
      } else if (paymentMethod === 'credit-card') {
        // Credit card not supported yet
        return false;
      }

      if (success && onRefresh) {
        // Refresh accounts after successful top-up
        await onRefresh();
      }

      return success;
    } catch (error) {
      console.error('Top-up error:', error);
      return false;
    }
  };

  // Handle withdraw confirmation
  const handleWithdrawConfirm = async (
    phoneNumber: string,
    amount: string,
    paymentMethod: 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card'
  ): Promise<boolean> => {
    try {
      let success = false;

      if (paymentMethod === 'mtn-momo') {
        // For MTN MoMo, we'll use the mobile payments API with GIVE_CHANGE type
        const response = await initiatePayment({
          amount: parseFloat(amount),
          currency: account.currency,
          description: 'Withdrawal',
          customerPhone: phoneNumber,
          accountId: account.id,
          provider: 'mypvit',
          paymentMethod: 'mobile_money',
          transactionType: 'GIVE_CHANGE',
        });

        success = response.success;
      } else if (
        paymentMethod === 'airtel-money' ||
        paymentMethod === 'moov-money'
      ) {
        // Use the unified mobile payments API for Airtel Money and MOOV
        const provider = paymentMethod === 'airtel-money' ? 'airtel' : 'moov';

        const response = await initiatePayment({
          amount: parseFloat(amount),
          currency: account.currency,
          description: 'Withdrawal',
          customerPhone: phoneNumber,
          accountId: account.id,
          provider,
          paymentMethod: 'mobile_money',
          transactionType: 'GIVE_CHANGE',
        });

        success = response.success;
      } else if (paymentMethod === 'credit-card') {
        // Credit card not supported yet
        return false;
      }

      if (success && onRefresh) {
        // Refresh accounts after successful withdrawal
        await onRefresh();
      }

      return success;
    } catch (error) {
      console.error('Withdrawal error:', error);
      return false;
    }
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6" color="primary">
                  {account.currency} {t('accounts.account')}
                </Typography>
                <Chip
                  label={
                    account.is_active
                      ? t('accounts.active')
                      : t('accounts.inactive')
                  }
                  size="small"
                  color={account.is_active ? 'success' : 'default'}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="h4" color="text.primary">
                  {formatCurrency(account.available_balance, account.currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accounts.availableBalance')}
                </Typography>
              </Box>

              {!compactView && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 2,
                    mt: 2,
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('accounts.totalBalance')}
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(account.total_balance, account.currency)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('accounts.withheldBalance')}
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(
                        account.withheld_balance,
                        account.currency
                      )}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary">
                {t('accounts.createdAt')}:{' '}
                {formatDate(new Date(account.created_at), 'PPP')}
              </Typography>
            </Box>

            {showTransactions && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  width: '100%',
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
                  fullWidth={true}
                  sx={{
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
                    fullWidth={true}
                    sx={{
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
          </Box>
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

      {/* Transaction History Dialog - Placeholder for now */}
      {/* This would need to be implemented with a proper transaction dialog component */}
    </>
  );
};

export default UserAccount;
