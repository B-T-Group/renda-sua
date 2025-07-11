import {
  AccountBalance as AccountBalanceIcon,
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
                          <IconButton
                            onClick={() => handleViewAccount(account)}
                            disabled={loading}
                          >
                            <VisibilityIcon />
                          </IconButton>
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
                              {transaction.description}
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
                                transaction.currency
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(
                                transaction.balance_after,
                                transaction.currency
                              )}
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
      </>
    );
  }
);

export default AccountManager;
