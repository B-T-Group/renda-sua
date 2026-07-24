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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import {
  type AccountTopUpRecord,
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

interface InitiatedContext {
  phone: string;
  amount: number;
  transactionId: string;
}

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
  const [initiatedCtx, setInitiatedCtx] = useState<InitiatedContext | null>(null);
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
    // Clear stale context immediately so the status card doesn't show
    // a previous transaction's details while the new request is in-flight.
    setInitiatedCtx(null);
    try {
      const fullPhone = `+${countryCode}${phoneNumber.trim()}`;
      const result = await initiateRecharge({ countryCode, phoneNumber: phoneNumber.trim(), amount: amountNum });
      setInitiatedCtx({ phone: fullPhone, amount: amountNum, transactionId: result.transactionId });
      setPolledTx(null);
      startPolling(result.transactionId);
      enqueueSnackbar(
        t('admin.accountRecharge.initiated', 'Recharge initiated. Waiting for mobile payment…'),
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

  const txStatus = polledTx?.status ?? (initiatedCtx ? 'pending' : null);

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
          'Initiate a mobile-money collection to top up the Rendasua HQ account. Funds are collected from the phone number provided and credited once confirmed.'
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

      {/* Post-initiation instruction + status panel */}
      {initiatedCtx && (
        <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('admin.accountRecharge.statusTitle', 'Payment status')}
          </Typography>

          {/* Instruction steps shown while pending */}
          {txStatus === 'pending' && (
            <Box sx={{ mb: 2.5 }}>
              <Alert
                icon={<PhoneAndroidIcon />}
                severity="info"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="body2" fontWeight="medium">
                  {t(
                    'admin.accountRecharge.sentToPhone',
                    'A payment request of {{amount}} XAF has been sent to {{phone}}.',
                    { amount: initiatedCtx.amount.toLocaleString(i18n.language), phone: initiatedCtx.phone }
                  )}
                </Typography>
              </Alert>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  pl: 1,
                }}
              >
                {[
                  {
                    icon: <PhoneAndroidIcon fontSize="small" color="primary" />,
                    text: t(
                      'admin.accountRecharge.step1',
                      'The owner of {{phone}} will receive a prompt on their mobile phone to approve the payment.',
                      { phone: initiatedCtx.phone }
                    ),
                  },
                  {
                    icon: <HourglassEmptyIcon fontSize="small" color="warning" />,
                    text: t(
                      'admin.accountRecharge.step2',
                      'Ask them to accept the request and enter their mobile money PIN.'
                    ),
                  },
                  {
                    icon: <AccountBalanceIcon fontSize="small" color="success" />,
                    text: t(
                      'admin.accountRecharge.step3',
                      'Once approved, the HQ account will be credited automatically and this status will update.'
                    ),
                  },
                ].map((step, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {step.icon}
                    <Typography variant="body2" color="text.secondary">
                      {step.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Live status row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            {polling && <CircularProgress size={18} />}
            <Chip
              label={t(`admin.accountRecharge.status.${txStatus ?? 'pending'}`, txStatus ?? 'Pending')}
              color={STATUS_COLOR[txStatus ?? 'pending'] ?? 'default'}
            />
            <Typography variant="caption" color="text.secondary">
              {t('admin.accountRecharge.txId', 'Transaction ID')}: {initiatedCtx.transactionId}
            </Typography>
          </Box>

          {polledTx?.status === 'success' && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mt: 1.5 }}>
              <Typography variant="body2" fontWeight="medium">
                {t(
                  'admin.accountRecharge.successTitle',
                  'Payment confirmed!'
                )}
              </Typography>
              <Typography variant="body2">
                {t(
                  'admin.accountRecharge.successMessage',
                  'The Rendasua HQ account has been credited with {{amount}} XAF from {{phone}}. The deposit appears in the "Recent recharges" table below.',
                  { amount: initiatedCtx.amount.toLocaleString(i18n.language), phone: initiatedCtx.phone }
                )}
              </Typography>
            </Alert>
          )}

          {polledTx?.status === 'failed' && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {polledTx.error_message ?? t('admin.accountRecharge.failedMessage', 'Payment failed.')}
            </Alert>
          )}

          {polledTx?.status === 'cancelled' && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {t('admin.accountRecharge.cancelledMessage', 'Payment was cancelled.')}
            </Alert>
          )}
        </Paper>
      )}

      {/* Recent confirmed deposits */}
      <Typography variant="h6" gutterBottom>
        {t('admin.accountRecharge.recentTitle', 'Recent recharges')}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.accountRecharge.colMemo', 'Description')}</TableCell>
              <TableCell align="right">{t('admin.accountRecharge.colAmount', 'Amount')}</TableCell>
              <TableCell>{t('admin.accountRecharge.colDate', 'Date')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactionsLoading && recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  {t('admin.accountRecharge.noRecentRecharges', 'No recent recharges found.')}
                </TableCell>
              </TableRow>
            ) : (
              recentTransactions.map((tx: AccountTopUpRecord) => (
                <TableRow key={tx.id}>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Typography variant="body2" noWrap title={tx.memo}>
                      {tx.memo}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{Number(tx.amount).toLocaleString(i18n.language)} XAF</TableCell>
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
