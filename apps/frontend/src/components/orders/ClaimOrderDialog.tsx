import {
  AttachMoney,
  CheckCircle,
  Info,
  LocalShipping,
  Phone,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';
import {
  MobilePaymentPhone,
  useMobilePaymentPhones,
} from '../../hooks/useMobilePaymentPhones';
import ClaimingOrderOverlay from '../common/ClaimingOrderOverlay';
import { MobilePaymentPhoneVerifyModal } from '../dialogs/MobilePaymentPhoneVerifyModal';

interface ClaimOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (phoneNumber?: string) => Promise<void>;
  order: OrderData;
  userPhoneNumber?: string;
  loading?: boolean;
  success?: boolean;
  error?: string;
}

const ClaimOrderDialog: React.FC<ClaimOrderDialogProps> = ({
  open,
  onClose,
  onConfirm,
  order,
  userPhoneNumber,
  loading = false,
  success = false,
  error,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [phoneNumber, setPhoneNumber] = useState(userPhoneNumber || '');
  const [phoneOverridden, setPhoneOverridden] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const { phones, setDefaultPhone } = useMobilePaymentPhones(open);

  useEffect(() => {
    if (!open) {
      setPhoneOverridden(false);
      return;
    }
    if (!phoneOverridden) setPhoneNumber(userPhoneNumber || '');
  }, [open, phoneOverridden, userPhoneNumber]);

  const holdAmount = order.agent_hold_amount || 0;

  const useLinkedPhone = async (phone: MobilePaymentPhone) => {
    setPhoneError('');
    try {
      const updated = await setDefaultPhone(phone.id);
      setPhoneOverridden(true);
      setPhoneNumber(updated.phone_e164);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.error', 'Something went wrong');
      setPhoneError(message);
    }
  };

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      setPhoneError(t('validation.phoneRequired', 'Phone number is required'));
      return;
    }

    try {
      await onConfirm(phoneNumber.trim() || undefined);
    } catch {
      // Error handling is done in the parent component
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          minHeight: isMobile ? '100vh' : 'auto',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'primary.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Phone color="primary" sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {t('agent.claimOrder.title', 'Claim Order with Payment')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'agent.claimOrder.subtitle',
                'Secure your delivery opportunity'
              )}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: isMobile ? 2 : 3, py: 2 }}>
        {/* Status Alerts */}
        {error ? (
          <Alert severity="error" sx={{ mb: 3 }} icon={<Warning />}>
            <Typography variant="body2" fontWeight="medium">
              {error}
            </Typography>
          </Alert>
        ) : success ? (
          <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}>
            <Typography variant="body2" fontWeight="medium">
              {t(
                'agent.claimOrder.successMessage',
                'Payment request sent successfully! Please check your phone and accept the payment request to claim the order.'
              )}
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }} icon={<Info />}>
            <Typography variant="body2" fontWeight="medium">
              {t(
                'agent.claimOrder.info',
                'A payment request will be sent to your phone number. Once you accept the payment request, the order will be automatically claimed by you.'
              )}
            </Typography>
          </Alert>
        )}

        <Stack
          direction={isMobile ? 'column' : 'row'}
          spacing={3}
          sx={{ mb: 3 }}
        >
          {/* Order Details Card */}
          <Box sx={{ flex: 1 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <LocalShipping color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    {t('agent.claimOrder.orderDetails', 'Order Details')}
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('agent.claimOrder.orderNumber', 'Order Number', {
                        orderNumber: order.order_number,
                      })}
                    </Typography>
                    <Chip
                      label={order.order_number}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('agent.claimOrder.deliveryEarnings', 'Your Earnings', {
                        deliveryFee: formatCurrency(
                          order.delivery_commission || 0,
                          order.currency
                        ),
                      })}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color="success.main"
                    >
                      {formatCurrency(
                        order.delivery_commission || 0,
                        order.currency
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Payment Details Card */}
          <Box sx={{ flex: 1 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <AttachMoney color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    {t('agent.claimOrder.paymentDetails', 'Payment Details')}
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('agent.claimOrder.holdAmount', 'Hold Amount')}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {formatCurrency(holdAmount, order.currency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t(
                        'agent.claimOrder.feeCovered',
                        'We cover the Mobile Money service charge.'
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Stack>

        {/* Payment Explanation Section */}
        <Paper
          variant="outlined"
          sx={{
            mt: 3,
            p: 3,
            bgcolor: 'info.50',
            border: '1px solid',
            borderColor: 'info.200',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Info color="info" />
            <Typography variant="h6" fontWeight="bold" color="info.main">
              {t(
                'agent.claimOrder.paymentExplanation.title',
                'Why do I need to make a payment?'
              )}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'agent.claimOrder.paymentExplanation.description',
                'This is a hold, not a fee. It stays as a guarantee until you finish the delivery. Then we release it and pay your earnings.'
              )}
          </Typography>

          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'info.main',
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t(
                  'agent.claimOrder.paymentExplanation.benefits.guarantee',
                  'Acts as a guarantee for order completion'
                )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'info.main',
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t(
                  'agent.claimOrder.paymentExplanation.benefits.trust',
                  'Builds trust with the system over time'
                )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'info.main',
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t(
                  'agent.claimOrder.paymentExplanation.benefits.reduction',
                  'Hold amount reduces with more completed orders'
                )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'info.main',
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t(
                  'agent.claimOrder.paymentExplanation.benefits.release',
                  'Amount is released upon successful delivery'
                )}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Phone Number Section */}
        <Paper
          variant="outlined"
          sx={{
            mt: 3,
            p: 3,
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Phone color="primary" />
              <Typography variant="h6" fontWeight="bold">
                {t('agent.claimOrder.requestSentTo', 'Request will be sent to')}
              </Typography>
            </Stack>
          </Stack>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            {phoneNumber ||
              t('agent.claimOrder.noPhoneNumber', 'No Mobile Money number linked')}
          </Typography>
          {phoneError ? (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {phoneError}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {phones
              .filter((item) => item.phone_e164 !== phoneNumber)
              .map((item) => (
                <Button
                  key={item.id}
                  size="small"
                  variant="text"
                  onClick={() => void useLinkedPhone(item)}
                >
                  {t('agent.claimOrder.useSavedPhone', 'Use {{phone}}', {
                    phone: item.phone_e164,
                  })}
                </Button>
              ))}
            <Button size="small" variant="outlined" onClick={() => setLinkOpen(true)}>
              {t('agent.claimOrder.linkNumber', 'Link a different number')}
            </Button>
          </Stack>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ px: isMobile ? 2 : 3, py: 2 }}>
        {success || error ? (
          <Button
            onClick={onClose}
            variant="contained"
            color="primary"
            fullWidth={isMobile}
            size="large"
          >
            {t('common.close', 'Close')}
          </Button>
        ) : (
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            width="100%"
            justifyContent="flex-end"
          >
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outlined"
              fullWidth={isMobile}
              size="large"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              disabled={loading || !phoneNumber.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : null}
              fullWidth={isMobile}
              size="large"
              sx={{
                minWidth: isMobile ? 'auto' : 200,
                fontWeight: 'bold',
              }}
            >
              {loading
                ? t('agent.claimOrder.processing', 'Processing...')
                : t('agent.claimOrder.confirmClaim', 'Confirm & Claim Order')}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
    <ClaimingOrderOverlay open={loading} />
    <MobilePaymentPhoneVerifyModal
      open={linkOpen}
      mode="add"
      setAsDefault
      allowSkipVerification
      onClose={() => setLinkOpen(false)}
      onCompleted={(phone) => {
        setPhoneOverridden(true);
        setPhoneNumber(phone.phone_e164);
        setLinkOpen(false);
      }}
    />
    </>
  );
};

export default ClaimOrderDialog;
