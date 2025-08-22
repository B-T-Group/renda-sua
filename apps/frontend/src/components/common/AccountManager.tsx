import {
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
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
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
// Using native Date formatting instead of date-fns
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Account,
  EntityType,
  useAccountManager,
} from '../../hooks/useAccountManager';
import { useAirtelMoney } from '../../hooks/useAirtelMoney';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useMtnMomoTopUp } from '../../hooks/useMtnMomoTopUp';
import { useProfile } from '../../hooks/useProfile';
import TopUpModal from '../business/TopUpModal';

interface AccountManagerProps {
  entityType: EntityType;
  entityId: string;
  title?: string;
  showTransactions?: boolean;
  showTotalSummary?: boolean;
  maxTransactions?: number;
  compactView?: boolean;
  emptyStateMessage?: string;
}

export interface AccountManagerRef {
  fetchAccounts: () => Promise<void>;
}

const AccountManager = forwardRef<AccountManagerRef, AccountManagerProps>(
  (
    {
      entityType,
      entityId,
      title,
      showTransactions = true,
      showTotalSummary = true,
      maxTransactions = 10,
      compactView = false,
      emptyStateMessage,
    },
    ref
  ) => {
    const { t } = useTranslation();

    // Account manager hook
    const {
      accounts,
      transactions,
      selectedAccount,
      loading,
      transactionsLoading,
      error,
      fetchAccounts,
      fetchAccountTransactions,
      selectAccount,
      clearSelectedAccount,
      clearError,
      getTotalBalance,
      getAvailableBalance,
    } = useAccountManager({ entityType, entityId });

    // Expose fetchAccounts function through ref
    useImperativeHandle(
      ref,
      () => ({
        fetchAccounts,
      }),
      [fetchAccounts]
    );

    // Dialog state
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

    // Top-up modal state
    const [topUpModalOpen, setTopUpModalOpen] = useState(false);
    const [selectedAccountForTopUp, setSelectedAccountForTopUp] =
      useState<Account | null>(null);

    // MTN MoMo top-up hook
    const { requestTopUp, loading: topUpLoading } = useMtnMomoTopUp();

    // Airtel Money hook
    const { requestPayment, loading: airtelLoading } = useAirtelMoney();

    // Mobile payments hook for Airtel Money and MOOV
    const { initiatePayment, loading: mobilePaymentsLoading } =
      useMobilePayments();

    // Get user profile for phone number
    const { userProfile } = useProfile();

    // Handle view account details
    const handleViewAccount = (account: Account) => {
      selectAccount(account);
      if (showTransactions) {
        setTransactionDialogOpen(true);
      }
    };

    // Handle refresh accounts
    const handleRefreshAccounts = async () => {
      await fetchAccounts();
    };

    // Handle top-up account
    const handleTopUp = (account: Account) => {
      setSelectedAccountForTopUp(account);
      setTopUpModalOpen(true);
    };

    // Handle top-up confirmation
    const handleTopUpConfirm = async (
      phoneNumber: string,
      amount: string,
      paymentMethod: 'mtn-momo' | 'airtel-money' | 'moov-money' | 'credit-card'
    ): Promise<boolean> => {
      if (!selectedAccountForTopUp) return false;

      try {
        let success = false;

        if (paymentMethod === 'mtn-momo') {
          success = await requestTopUp({
            phoneNumber,
            amount,
            currency: selectedAccountForTopUp.currency,
          });
        } else if (
          paymentMethod === 'airtel-money' ||
          paymentMethod === 'moov-money'
        ) {
          // Use the unified mobile payments API for Airtel Money and MOOV
          const provider = paymentMethod === 'airtel-money' ? 'airtel' : 'moov';

          const response = await initiatePayment({
            amount: parseFloat(amount),
            currency: selectedAccountForTopUp.currency,
            description: 'Account Top Up',
            customerPhone: phoneNumber,
            product: 'Account',
            agent: 'Rendasua',
            accountId: selectedAccountForTopUp.id, // Use accountId for customer_account_number
            provider,
            paymentMethod: 'mobile_money',
          });

          success = response.success;
        } else if (paymentMethod === 'credit-card') {
          // Credit card not supported yet
          return false;
        }

        if (success) {
          // Refresh accounts after successful top-up
          await fetchAccounts();
        }

        return success;
      } catch (error) {
        console.error('Top-up error:', error);
        return false;
      }
    };

    // Format currency amount
    const formatCurrency = (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    // Format date - replacement for date-fns format function
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

    // Format transaction type
    const formatTransactionType = (type: string) => {
      return t(`accounts.transactionTypes.${type}`, type);
    };

    // Get transaction type color
    const getTransactionTypeColor = (type: string, amount: number) => {
      if (amount > 0) return 'success';
      if (amount < 0) return 'error';
      return 'default';
    };

    // Get transaction type icon
    const getTransactionTypeIcon = (type: string, amount: number) => {
      if (amount > 0) return <TrendingUpIcon fontSize="small" />;
      if (amount < 0) return <TrendingDownIcon fontSize="small" />;
      return <HistoryIcon fontSize="small" />;
    };

    // Capitalize entity type for display
    const capitalizeEntityType = (type: EntityType) => {
      return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // Get unique currencies
    const currencies = [
      ...new Set(accounts.map((account) => account.currency)),
    ];

    // Loading skeleton
    if (loading && accounts.length === 0) {
      return (
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Skeleton variant="text" width={150} height={32} />
              <Skeleton variant="rectangular" width={100} height={36} />
            </Box>
            <Stack spacing={2}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={120} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        <Card>
          <CardContent>
            {/* Header */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                {title ||
                  `${capitalizeEntityType(entityType)} ${t('accounts.title')}`}
              </Typography>
              <IconButton
                onClick={handleRefreshAccounts}
                disabled={loading}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Box>

            {/* Error Message */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
                {error}
              </Alert>
            )}

            {/* Total Summary */}
            {showTotalSummary && accounts.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('accounts.summary')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 2,
                  }}
                >
                  {currencies.map((currency) => (
                    <Card key={currency} variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(getTotalBalance(currency), currency)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('accounts.totalBalance')} ({currency})
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          {t('accounts.available')}:{' '}
                          {formatCurrency(
                            getAvailableBalance(currency),
                            currency
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* Account List */}
            {accounts.length === 0 ? (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                py={4}
              >
                <AccountBalanceIcon
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                />
                <Typography
                  variant="body1"
                  color="text.secondary"
                  textAlign="center"
                >
                  {emptyStateMessage || t('accounts.noAccounts')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {accounts.map((account) => (
                  <Card key={account.id} variant="outlined">
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Box flex={1}>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={1}
                          >
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
                              {formatCurrency(
                                account.available_balance,
                                account.currency
                              )}
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
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t('accounts.totalBalance')}
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {formatCurrency(
                                    account.total_balance,
                                    account.currency
                                  )}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
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
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              onClick={() => handleViewAccount(account)}
                              disabled={loading}
                              title={t('accounts.viewTransactions')}
                            >
                              <VisibilityIcon />
                            </IconButton>
                            <Button
                              onClick={() => handleTopUp(account)}
                              disabled={loading}
                              variant="contained"
                              size="small"
                              startIcon={<AddIcon />}
                              sx={{
                                background:
                                  'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                                color: 'white',
                                fontWeight: 600,
                                textTransform: 'none',
                                boxShadow:
                                  '0 3px 5px 2px rgba(76, 175, 80, .3)',
                                '&:hover': {
                                  background:
                                    'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)',
                                  boxShadow:
                                    '0 4px 8px 2px rgba(76, 175, 80, .4)',
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
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Transaction History Dialog */}
        <Dialog
          open={transactionDialogOpen}
          onClose={() => {
            setTransactionDialogOpen(false);
            clearSelectedAccount();
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <HistoryIcon />
              {t('accounts.transactionHistory')}
              {selectedAccount && (
                <Chip
                  label={`${selectedAccount.currency} ${t('accounts.account')}`}
                  size="small"
                  color="primary"
                />
              )}
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedAccount && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('accounts.accountSummary')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('accounts.availableBalance')}
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatCurrency(
                        selectedAccount.available_balance,
                        selectedAccount.currency
                      )}
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('accounts.totalBalance')}
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(
                        selectedAccount.total_balance,
                        selectedAccount.currency
                      )}
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('accounts.withheldBalance')}
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {formatCurrency(
                        selectedAccount.withheld_balance,
                        selectedAccount.currency
                      )}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Transaction List */}
            <Typography variant="h6" gutterBottom>
              {t('accounts.recentTransactions')}
            </Typography>

            {transactionsLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={60} />
                ))}
              </Stack>
            ) : transactions.length === 0 ? (
              <Box textAlign="center" py={4}>
                <HistoryIcon
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                />
                <Typography variant="body1" color="text.secondary">
                  {t('accounts.noTransactions')}
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('accounts.date')}</TableCell>
                      <TableCell>{t('accounts.type')}</TableCell>
                      <TableCell>{t('accounts.description')}</TableCell>
                      <TableCell align="right">
                        {t('accounts.amount')}
                      </TableCell>
                      <TableCell align="right">
                        {t('accounts.balance')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions
                      .slice(0, maxTransactions)
                      .map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(
                                new Date(transaction.created_at),
                                'PPp'
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getTransactionTypeIcon(
                                transaction.transaction_type,
                                transaction.amount
                              )}
                              label={formatTransactionType(
                                transaction.transaction_type
                              )}
                              size="small"
                              color={getTransactionTypeColor(
                                transaction.transaction_type,
                                transaction.amount
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {transaction.memo || t('accounts.noDescription')}
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
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {t('accounts.balanceNotAvailable')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {selectedAccount && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  onClick={() =>
                    fetchAccountTransactions(
                      selectedAccount.id,
                      maxTransactions * 2
                    )
                  }
                  disabled={transactionsLoading}
                  variant="outlined"
                  size="small"
                >
                  {t('accounts.loadMore')}
                </Button>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Top Up Modal */}
        {selectedAccountForTopUp && (
          <TopUpModal
            open={topUpModalOpen}
            onClose={() => {
              setTopUpModalOpen(false);
              setSelectedAccountForTopUp(null);
            }}
            userPhoneNumber={userProfile?.phone_number || ''}
            currency={selectedAccountForTopUp.currency}
            loading={topUpLoading || airtelLoading || mobilePaymentsLoading}
            onConfirm={handleTopUpConfirm}
          />
        )}
      </>
    );
  }
);

export default AccountManager;
