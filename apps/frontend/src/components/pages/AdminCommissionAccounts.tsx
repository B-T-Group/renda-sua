import {
  AccountBalance as AccountBalanceIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
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
import { useAdminAccountTransactions } from '../../hooks/useAdminAccountTransactions';
import { useAdminCommissionAccounts } from '../../hooks/useAdminCommissionAccounts';

const AdminCommissionAccounts: React.FC = () => {
  const {
    companyAccount,
    partnerAccounts,
    loading,
    error,
    fetchCommissionUsers,
  } = useAdminCommissionAccounts();
  const {
    transactions,
    pagination,
    loading: transactionsLoading,
    error: transactionsError,
    fetchTransactions,
  } = useAdminAccountTransactions();
  const { t } = useTranslation();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [selectedAccountCurrency, setSelectedAccountCurrency] = useState<
    string | null
  >(null);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleViewTransactions = (accountId: string, currency: string) => {
    setSelectedAccountId(accountId);
    setSelectedAccountCurrency(currency);
    setCurrentPage(1);
    setTransactionsDialogOpen(true);
    fetchTransactions(accountId, 1, 50);
  };

  const handleCloseTransactionsDialog = () => {
    setTransactionsDialogOpen(false);
    setSelectedAccountId(null);
    setSelectedAccountCurrency(null);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (selectedAccountId) {
      setCurrentPage(newPage);
      fetchTransactions(selectedAccountId, newPage, 50);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get transaction type color based on type and amount
  const getTransactionTypeColor = (type: string, amount: number) => {
    // Hold and release transactions are neither credit nor debit - show gray
    if (type === 'hold' || type === 'release') return 'default';
    
    // Fee and payment are debits (payment from account) - show red
    if (type === 'fee' || type === 'payment') return 'error';
    
    // Deposit is a credit - show green
    if (type === 'deposit') return 'success';
    
    // For other types, use amount-based logic
    const parsedAmount = parseFloat(String(amount));
    if (parsedAmount > 0) return 'success';
    if (parsedAmount < 0) return 'error';
    return 'default';
  };

  // Get transaction amount display color
  const getTransactionAmountColor = (type: string, amount: number) => {
    // Hold and release transactions should be gray (neither credit nor debit)
    if (type === 'hold' || type === 'release') return 'text.secondary';
    
    // Fee and payment are debits - show red
    if (type === 'fee' || type === 'payment') return 'error.main';
    
    // Deposit is a credit - show green
    if (type === 'deposit') return 'success.main';
    
    // For other types, use amount-based logic
    const parsedAmount = parseFloat(String(amount));
    return parsedAmount >= 0 ? 'success.main' : 'error.main';
  };

  // Format transaction amount with appropriate sign
  const formatTransactionAmount = (type: string, amount: number, currency: string) => {
    const parsedAmount = parseFloat(String(amount));
    
    // Hold and release transactions show amount without sign (neutral)
    if (type === 'hold' || type === 'release') {
      return formatCurrency(Math.abs(parsedAmount), currency);
    }
    
    // Fee and payment are debits - show as negative
    if (type === 'fee' || type === 'payment') {
      return '-' + formatCurrency(Math.abs(parsedAmount), currency);
    }
    
    // Deposit is a credit - show as positive
    if (type === 'deposit') {
      return '+' + formatCurrency(Math.abs(parsedAmount), currency);
    }
    
    // For other types, use amount-based logic
    const sign = parsedAmount >= 0 ? '+' : '';
    return sign + formatCurrency(parsedAmount, currency);
  };

  const renderAccountCard = (
    user: any,
    isCompanyAccount: boolean = false
  ) => {
    if (!user || !user.accounts || user.accounts.length === 0) {
      return null;
    }

    return (
      <Card key={user.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h6" gutterBottom>
                {isCompanyAccount
                  ? t(
                      'admin.commissionAccounts.companyAccount',
                      'Company Account'
                    )
                  : `${user.first_name} ${user.last_name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
              {isCompanyAccount && (
                <Chip
                  label={t('admin.commissionAccounts.companyAccount', 'Company')}
                  color="primary"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
              {!isCompanyAccount && (
                <Chip
                  label={t('admin.commissionAccounts.partner', 'Partner')}
                  color="secondary"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {user.accounts.map((account: any) => (
              <Paper
                key={account.id}
                variant="outlined"
                sx={{ p: 2, backgroundColor: 'background.default' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="bold">
                    {account.currency}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() =>
                      handleViewTransactions(account.id, account.currency)
                    }
                  >
                    {t(
                      'admin.commissionAccounts.viewTransactions',
                      'View Transactions'
                    )}
                  </Button>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                    mt: 2,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'admin.commissionAccounts.availableBalance',
                        'Available Balance'
                      )}
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatCurrency(
                        parseFloat(account.available_balance),
                        account.currency
                      )}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'admin.commissionAccounts.withheldBalance',
                        'Withheld Balance'
                      )}
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {formatCurrency(
                        parseFloat(account.withheld_balance),
                        account.currency
                      )}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        'admin.commissionAccounts.totalBalance',
                        'Total Balance'
                      )}
                    </Typography>
                    <Typography variant="h6" color="primary.main">
                      {formatCurrency(
                        parseFloat(account.total_balance),
                        account.currency
                      )}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h5">
          {t('admin.commissionAccounts.title', 'Company Accounts & Partners')}
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchCommissionUsers}
          disabled={loading}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Box>

      {error && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent>
            <Typography>{t('common.loading', 'Loading...')}</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Company Account Section */}
          {companyAccount && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                {t('admin.commissionAccounts.companyAccount', 'Company Account')}
              </Typography>
              {renderAccountCard(companyAccount, true)}
            </Box>
          )}

          {/* Partner Accounts Section */}
          {partnerAccounts.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                {t(
                  'admin.commissionAccounts.partnerAccounts',
                  'Partner Accounts'
                )}
              </Typography>
              {partnerAccounts.map((partner) => renderAccountCard(partner))}
            </Box>
          )}

          {!companyAccount && partnerAccounts.length === 0 && (
            <Card>
              <CardContent>
                <Typography color="text.secondary">
                  {t(
                    'admin.commissionAccounts.noAccounts',
                    'No commission accounts found'
                  )}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Transactions Dialog */}
      <Dialog
        open={transactionsDialogOpen}
        onClose={handleCloseTransactionsDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {t('admin.commissionAccounts.transactions', 'Account Transactions')}
          {selectedAccountCurrency && ` - ${selectedAccountCurrency}`}
        </DialogTitle>
        <DialogContent>
          {transactionsError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {transactionsError}
            </Typography>
          )}
          {transactionsLoading ? (
            <Typography>{t('common.loading', 'Loading...')}</Typography>
          ) : transactions.length === 0 ? (
            <Typography color="text.secondary">
              {t(
                'admin.commissionAccounts.noTransactions',
                'No transactions found'
              )}
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {t('admin.commissionAccounts.date', 'Date')}
                      </TableCell>
                      <TableCell>
                        {t('admin.commissionAccounts.type', 'Type')}
                      </TableCell>
                      <TableCell>
                        {t('admin.commissionAccounts.amount', 'Amount')}
                      </TableCell>
                      <TableCell>
                        {t('admin.commissionAccounts.memo', 'Memo')}
                      </TableCell>
                      <TableCell>
                        {t(
                          'admin.commissionAccounts.referenceId',
                          'Reference ID'
                        )}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(transaction.created_at)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={transaction.transaction_type}
                            size="small"
                            color={getTransactionTypeColor(
                              transaction.transaction_type,
                              parseFloat(String(transaction.amount))
                            )}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            color: getTransactionAmountColor(
                              transaction.transaction_type,
                              parseFloat(String(transaction.amount))
                            ),
                            fontWeight: 'bold',
                          }}
                        >
                          {formatTransactionAmount(
                            transaction.transaction_type,
                            parseFloat(String(transaction.amount)),
                            transaction.account.currency
                          )}
                        </TableCell>
                        <TableCell>{transaction.memo || '-'}</TableCell>
                        <TableCell>
                          {transaction.reference_id
                            ? transaction.reference_id.substring(0, 8) + '...'
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {pagination.totalPages > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('common.results', '{{count}} results', {
                      count: pagination.total,
                    })}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!pagination.hasPrev}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      {t('common.prev', 'Prev')}
                    </Button>
                    <Typography variant="body2">
                      {t('common.page', 'Page')} {currentPage} /{' '}
                      {pagination.totalPages}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!pagination.hasNext}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      {t('common.next', 'Next')}
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTransactionsDialog}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCommissionAccounts;

