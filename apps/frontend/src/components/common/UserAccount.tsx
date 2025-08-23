import {
  Add as AddIcon,
  History as HistoryIcon,
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
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountById } from '../../hooks/useAccountInfo';
import { useAirtelMoney } from '../../hooks/useAirtelMoney';
import { useGraphQLRequest } from '../../hooks/useGraphQLRequest';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';
import WithdrawModal from '../business/WithdrawModal';

// GraphQL query for fetching account transactions
const GET_ACCOUNT_TRANSACTIONS = `
  query GetAccountTransactions($accountId: uuid!, $limit: Int = 10) {
    account_transactions(
      where: { account_id: { _eq: $accountId } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      id
      account_id
      transaction_type
      amount
      memo
      reference_id
      created_at
      account {
        currency
      }
    }
  }
`;

export interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  memo?: string;
  reference_id?: string;
  created_at: string;
  account: {
    currency: string;
  };
}

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
  const { account, loading, error, subscriptionFailed } =
    useAccountById(accountId);

  // Modal states
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  // Transaction state
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Confirmation message states
  const [showTopUpSuccess, setShowTopUpSuccess] = useState(false);
  const [showWithdrawSuccess, setShowWithdrawSuccess] = useState(false);

  // Hooks for payment operations
  const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();
  const { initiatePayment, loading: mobilePaymentsLoading } =
    useMobilePayments();
  const { loading: airtelLoading } = useAirtelMoney();

  // GraphQL hook for transactions
  const { execute: executeTransactionsQuery } = useGraphQLRequest(
    GET_ACCOUNT_TRANSACTIONS
  );

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

  const fetchAccountTransactions = async (limit: number = 10) => {
    setTransactionsLoading(true);

    try {
      const result = await executeTransactionsQuery({
        accountId: accountId,
        limit,
      });

      const transactionData = result.account_transactions || [];
      setTransactions(transactionData);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const handleViewTransactions = () => {
    setTransactionDialogOpen(true);
    fetchAccountTransactions();
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
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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

      {/* Transaction History Dialog */}
      <Dialog
        open={transactionDialogOpen}
        onClose={() => setTransactionDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            {t('accounts.transactionHistory')}
            <Chip
              label={`${account.currency} ${t('accounts.account')}`}
              size="small"
              color="primary"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('accounts.balance')}
            </Typography>
            <Box display="flex" justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('accounts.available')}:
                </Typography>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(account.available_balance, account.currency)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('accounts.withheld')}:
                </Typography>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(account.withheld_balance, account.currency)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('accounts.balance')}:
                </Typography>
                <Typography variant="h6" color="primary.main">
                  {formatCurrency(account.total_balance, account.currency)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {transactionsLoading ? (
            <Typography>{t('common.loading')}...</Typography>
          ) : transactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('accounts.noTransactions')}
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('accounts.date')}</TableCell>
                    <TableCell>{t('accounts.type')}</TableCell>
                    <TableCell>{t('accounts.description')}</TableCell>
                    <TableCell align="right">{t('accounts.amount')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(transaction.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.transaction_type}
                          size="small"
                          color={transaction.amount >= 0 ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {transaction.memo ||
                            transaction.reference_id ||
                            t('accounts.noDescription')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={
                            transaction.amount >= 0
                              ? 'success.main'
                              : 'error.main'
                          }
                          fontWeight="medium"
                        >
                          {transaction.amount >= 0 ? '+' : ''}
                          {formatCurrency(
                            transaction.amount,
                            transaction.account.currency
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              onClick={() => fetchAccountTransactions(transactions.length + 10)}
              disabled={transactionsLoading}
              variant="outlined"
              size="small"
            >
              {t('accounts.loadMore')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAccount;
