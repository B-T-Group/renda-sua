import { AccountBalance } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useMobilePayments } from '../../hooks/useMobilePayments';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import WithdrawModal from '../business/WithdrawModal';

const XAF_CURRENCY = 'XAF';

const MobileBalanceChip: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    accounts,
    accountsLoading,
    profile,
    refetchAccounts,
  } = useUserProfileContext();
  const { initiatePayment, loading: withdrawLoading } = useMobilePayments();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const xafAccount = accounts.find((a) => a.currency === XAF_CURRENCY);

  const formatBalance = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: XAF_CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (accountsLoading) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleViewTransactions = () => {
    handleClose();
    navigate('/profile');
  };

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
    </>
  );
};

export default MobileBalanceChip;
