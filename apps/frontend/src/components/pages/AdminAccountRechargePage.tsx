import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import {
  type RechargeTransaction,
  useAccountRecharge,
} from '../../hooks/useAccountRecharge';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const SUPPORTED_COUNTRIES = [
  { code: '237', label: 'Cameroon (+237)', flag: '🇨🇲' },
  { code: '241', label: 'Gabon (+241)', flag: '🇬🇦' },
];

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  success: 'success',
  failed: 'error',
  cancelled: 'default',
};

const AdminAccountRechargePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const canAccess = usePermission(PlatformPermissions.RECHARGE_ACCOUNT);

  const {
    loading,
    error,
    recentTransactions,
    transactionsLoading,
    initiateRecharge,
    getRechargeStatus,
    loadRecentTransactions,
  } = useAccountRecharge();

  const [countryCode, setCountryCode] = useState('237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [polledTx, setPolledTx] = useState<RechargeTransaction | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  const startPolling = useCallback(
    (txId: string) => {
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const tx = await getRechargeStatus(txId);
          setPolledTx(tx);
          if (tx.status !== 'pending') {
            stopPolling();
            void loadRecentTransactions();
          }
        } catch {
          stopPolling();
        }
      }, 5000);
    },
    [getRechargeStatus, loadRecentTransactions, stopPolling]
  );

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!phoneNumber.trim()) {
      setFormError(t('admin.accountRecharge.phoneRequired', 'Phone number is required'));
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum < 150) {
      setFormError(t('admin.accountRecharge.amountMin', 'Amount must be at least 150 XAF'));
      return;
    }
    try {
      const result = await initiateRecharge({ countryCode, phoneNumber: phoneNumber.trim(), amount: amountNum });
      setLastTxId(result.transactionId);
      setPolledTx(null);
      startPolling(result.transactionId);
      enqueueSnackbar(
        t('admin.accountRecharge.initiated', 'Recharge initiated. Waiting for mobile payment...'),
        { variant: 'info' }
      );
      setPhoneNumber('');
      setAmount('');
    } catch {
      // error already set by hook
    }
  }, [amount, countryCode, enqueueSnackbar, initiateRecharge, phoneNumber, startPolling, t]);

  if (profileLoading) return <LoadingScreen />;

  if (!profile?.business) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography color="error">
          {t('admin.accountRecharge.noBusinessProfile', 'Business profile not found')}
        </Typography>
      </Container>
    );
  }

  if (!canAccess) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          {t('admin.accountRecharge.unauthorized', 'You are not authorized to access this page')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <SEOHead
        title={t('admin.accountRecharge.pageTitle', 'HQ account recharge')}
        description={t(
          'admin.accountRecharge.pageDescription',
          'Initiate a mobile-money collection to top up the Rendasua HQ account'
        )}
        keywords={t('admin.accountRecharge.pageKeywords', 'admin, account recharge, mobile money')}
      />

      <Typography variant="h4" component="h1" gutterBottom>
        {t('admin.accountRecharge.pageTitle', 'HQ account recharge')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'admin.accountRecharge.pageDescription',
          'Initiate a mobile-money collection to top up the Rendasua HQ account. Funds are collected from the phone number provided and credited to the HQ XAF account once confirmed.'
        )}
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t('admin.accountRecharge.formTitle', 'Initiate payment')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <FormControl fullWidth>
            <InputLabel id="country-code-label">
              {t('admin.accountRecharge.countryCode', 'Country')}
            </InputLabel>
            <Select
              labelId="country-code-label"
              value={countryCode}
              label={t('admin.accountRecharge.countryCode', 'Country')}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.flag} {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('admin.accountRecharge.phoneNumber', 'Phone number (local)')}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder={countryCode === '237' ? '670000000' : '06 00 00 00'}
            helperText={t(
              'admin.accountRecharge.phoneHelp',
              'Enter the local number without the country code'
            )}
            fullWidth
          />

          <TextField
            label={t('admin.accountRecharge.amount', 'Amount (XAF)')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            inputProps={{ min: 150, step: 100 }}
            helperText={t('admin.accountRecharge.amountHelp', 'Minimum 150 XAF')}
            fullWidth
          />

          {(formError || error) && (
            <Alert severity="error">{formError ?? error}</Alert>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={loading || polling}
            onClick={() => void handleSubmit()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
            ) : null}
            {t('admin.accountRecharge.initiateButton', 'Initiate payment')}
          </Button>
        </Box>
      </Paper>

      {lastTxId && (
        <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('admin.accountRecharge.statusTitle', 'Payment status')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {polling && <CircularProgress size={20} />}
            {polledTx ? (
              <Chip
                label={t(`admin.accountRecharge.status.${polledTx.status}`, polledTx.status)}
                color={STATUS_COLOR[polledTx.status] ?? 'default'}
              />
            ) : (
              <Chip
                label={t('admin.accountRecharge.status.pending', 'Pending')}
                color="warning"
              />
            )}
            <Typography variant="body2" color="text.secondary">
              {t('admin.accountRecharge.txId', 'Transaction ID')}: {lastTxId}
            </Typography>
          </Box>
          {polledTx?.status === 'success' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t(
                'admin.accountRecharge.successMessage',
                'Payment confirmed. The HQ account has been credited.'
              )}
            </Alert>
          )}
          {polledTx?.status === 'failed' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {polledTx.error_message ?? t('admin.accountRecharge.failedMessage', 'Payment failed.')}
            </Alert>
          )}
        </Paper>
      )}

      <Typography variant="h6" gutterBottom>
        {t('admin.accountRecharge.recentTitle', 'Recent recharges')}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.accountRecharge.colReference', 'Reference')}</TableCell>
              <TableCell align="right">{t('admin.accountRecharge.colAmount', 'Amount')}</TableCell>
              <TableCell>{t('admin.accountRecharge.colPhone', 'Phone')}</TableCell>
              <TableCell>{t('admin.accountRecharge.colProvider', 'Provider')}</TableCell>
              <TableCell>{t('admin.accountRecharge.colStatus', 'Status')}</TableCell>
              <TableCell>{t('admin.accountRecharge.colDate', 'Date')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactionsLoading && recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  {t('admin.accountRecharge.noRecentRecharges', 'No recent recharges found.')}
                </TableCell>
              </TableRow>
            ) : (
              recentTransactions.map((tx: RechargeTransaction) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.reference}</TableCell>
                  <TableCell align="right">{Number(tx.amount).toLocaleString(i18n.language)} XAF</TableCell>
                  <TableCell>{tx.customer_phone ?? '—'}</TableCell>
                  <TableCell>{tx.provider}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`admin.accountRecharge.status.${tx.status}`, tx.status)}
                      color={STATUS_COLOR[tx.status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>{new Date(tx.created_at).toLocaleString(i18n.language)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default AdminAccountRechargePage;
