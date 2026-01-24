import { AccountBalance, History as HistoryIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  List,
  ListItem,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useGraphQLRequest } from '../../hooks/useGraphQLRequest';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import WithdrawModal from '../business/WithdrawModal';

const XAF_CURRENCY = 'XAF';
const TRANSACTIONS_LIMIT = 20;

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
      account { currency }
    }
  }
`;

interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  memo?: string;
  reference_id?: string;
  created_at: string;
  account: { currency: string };
}

const MobileBalanceChip: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    accounts,
    accountsLoading,
    profile,
    refetchAccounts,
  } = useUserProfileContext();
  const { initiatePayment, loading: withdrawLoading } = useMobilePayments();
  const { execute: executeTransactionsQuery } = useGraphQLRequest<{
    account_transactions: AccountTransaction[];
  }>(GET_ACCOUNT_TRANSACTIONS, { showLoading: false });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [transactionsDrawerOpen, setTransactionsDrawerOpen] = useState(false);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const xafAccount = accounts.find((a) => a.currency === XAF_CURRENCY);

  const formatBalance = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: XAF_CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const getTransactionTypeColor = (
    type: string,
    amount: number
  ): 'default' | 'success' | 'error' => {
    if (type === 'hold' || type === 'release') return 'default';
    if (['deposit', 'refund', 'exchange'].includes(type)) return 'success';
    if (['withdrawal', 'payment', 'fee', 'transfer'].includes(type))
      return 'error';
    if (type === 'adjustment') return amount > 0 ? 'success' : 'error';
    return amount > 0 ? 'success' : amount < 0 ? 'error' : 'default';
  };

  const getTransactionAmountColor = (type: string, amount: number): string => {
    if (type === 'hold' || type === 'release') return 'text.secondary';
    if (['deposit', 'refund', 'exchange'].includes(type)) return 'success.main';
    if (['withdrawal', 'payment', 'fee', 'transfer'].includes(type))
      return 'error.main';
    if (type === 'adjustment') return amount > 0 ? 'success.main' : 'error.main';
    return amount >= 0 ? 'success.main' : 'error.main';
  };

  const formatTransactionAmount = (
    type: string,
    amount: number,
    currency: string
  ): string => {
    if (type === 'hold' || type === 'release')
      return formatCurrency(Math.abs(amount), currency);
    if (['deposit', 'refund', 'exchange'].includes(type))
      return '+' + formatCurrency(Math.abs(amount), currency);
    if (['withdrawal', 'payment', 'fee', 'transfer'].includes(type))
      return '-' + formatCurrency(Math.abs(amount), currency);
    if (type === 'adjustment') {
      const sign = amount > 0 ? '+' : '-';
      return sign + formatCurrency(Math.abs(amount), currency);
    }
    const sign = amount >= 0 ? '+' : '';
    return sign + formatCurrency(amount, currency);
  };

  const fetchAccountTransactions = useCallback(
    async (limit = TRANSACTIONS_LIMIT) => {
      if (!xafAccount) return;
      setTransactionsLoading(true);
      try {
        const result = await executeTransactionsQuery({
          accountId: xafAccount.id,
          limit,
        });
        setTransactions(result?.account_transactions ?? []);
      } catch {
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    },
    [xafAccount, executeTransactionsQuery]
  );

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (accountsLoading) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleViewTransactions = () => {
    handleClose();
    setTransactionsDrawerOpen(true);
    fetchAccountTransactions();
  };

  const handleTransactionsDrawerClose = () => setTransactionsDrawerOpen(false);

  const handleWithdrawClick = () => {
    handleClose();
    setWithdrawModalOpen(true);
  };

  const handleWithdrawClose = () => setWithdrawModalOpen(false);

  const handleWithdrawConfirm = async (
    phoneNumber: string,
    amount: string,
    _paymentMethod: string
  ): Promise<boolean> => {
    if (!xafAccount) return false;
    try {
      const result = await initiatePayment({
        amount: parseFloat(amount),
        currency: xafAccount.currency,
        description: 'Withdrawal',
        customerPhone: phoneNumber,
        accountId: xafAccount.id,
        transactionType: 'GIVE_CHANGE',
      });
      if (result.success) {
        enqueueSnackbar(t('accounts.withdrawSuccess'), { variant: 'success' });
        await refetchAccounts();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  if (!xafAccount && !accountsLoading) return null;

  return (
    <>
      <Button
        onClick={handleOpen}
        disabled={accountsLoading}
        startIcon={
          accountsLoading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <AccountBalance fontSize="small" />
          )
        }
        sx={{
          minHeight: 44,
          minWidth: 44,
          py: 1,
          px: 1.5,
          color: '#1d1d1f',
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8rem',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        {accountsLoading ? (
          <Typography variant="body2" color="text.secondary">
            …
          </Typography>
        ) : (
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {formatBalance(xafAccount!.total_balance)}
          </Box>
        )}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 200,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
        }}
      >
        <MenuItem onClick={handleViewTransactions} sx={{ py: 1.5 }}>
          {t('accounts.viewTransactions')}
        </MenuItem>
        {xafAccount && xafAccount.available_balance > 0 && (
          <MenuItem onClick={handleWithdrawClick} sx={{ py: 1.5 }}>
            {t('accounts.withdraw')}
          </MenuItem>
        )}
      </Menu>

      {xafAccount && (
        <WithdrawModal
          open={withdrawModalOpen}
          onClose={handleWithdrawClose}
          onConfirm={handleWithdrawConfirm}
          userPhoneNumber={profile?.phone_number || ''}
          currency={xafAccount.currency}
          availableBalance={xafAccount.available_balance}
          loading={withdrawLoading}
        />
      )}

      <Drawer
        anchor="bottom"
        open={transactionsDrawerOpen}
        onClose={handleTransactionsDrawerClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
            touchAction: 'pan-y',
          },
        }}
      >
        <Box sx={{ pt: 1.5, pb: 2, px: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 4,
              borderRadius: 2,
              bgcolor: 'grey.300',
              mx: 'auto',
              mb: 2,
            }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <HistoryIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {t('accounts.viewTransactions')}
            </Typography>
            <Chip
              label={`${xafAccount?.currency ?? XAF_CURRENCY} ${t('accounts.account')}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          {xafAccount && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1.5,
                px: 2,
                borderRadius: 1,
                bgcolor: 'action.hover',
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('accounts.availableBalance')}
              </Typography>
              <Typography variant="subtitle1" fontWeight={600} color="success.main">
                {formatBalance(xafAccount.available_balance)}
              </Typography>
            </Box>
          )}
          <Divider sx={{ mb: 1 }} />
          {transactionsLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
                gap: 1,
              }}
            >
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                {t('common.loading')}…
              </Typography>
            </Box>
          ) : transactions.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 4, textAlign: 'center' }}
            >
              {t('accounts.noTransactions')}
            </Typography>
          ) : (
            <List
              disablePadding
              sx={{
                maxHeight: '55vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {transactions.map((tx) => (
                <ListItem
                  key={tx.id}
                  disablePadding
                  sx={{
                    py: 1.5,
                    minHeight: 56,
                    borderBottom: 1,
                    borderColor: 'divider',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 0.5,
                    }}
                  >
                    <Chip
                      label={tx.transaction_type}
                      size="small"
                      color={getTransactionTypeColor(tx.transaction_type, tx.amount)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: getTransactionAmountColor(tx.transaction_type, tx.amount),
                        fontWeight: 600,
                      }}
                    >
                      {formatTransactionAmount(
                        tx.transaction_type,
                        tx.amount,
                        tx.account?.currency ?? XAF_CURRENCY
                      )}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {formatDate(tx.created_at)}
                  </Typography>
                  {(tx.memo || tx.reference_id) && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.25 }}
                      noWrap
                    >
                      {tx.memo || tx.reference_id || t('accounts.noDescription')}
                    </Typography>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default MobileBalanceChip;
