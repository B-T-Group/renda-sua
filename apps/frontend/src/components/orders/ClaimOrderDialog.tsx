import {
  AttachMoney,
  CheckCircle,
  Edit,
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
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';
import PhoneInput from '../common/PhoneInput';

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
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Calculate hold amount (80% of item price only, not including delivery fees)
  const holdPercentage = 80;
  const holdAmount = (order.subtotal * holdPercentage) / 100;

  // Calculate charge amount (3.5% of hold amount)
  const chargePercentage = 3.5;
  const chargeAmount = (holdAmount * chargePercentage) / 100;

  // Total amount to be charged
  const totalChargeAmount = holdAmount + chargeAmount;

  const handlePhoneChange = (value: string | undefined) => {
    setPhoneNumber(value || '');
    setPhoneError('');
  };

  const handleEditPhone = () => {
    setIsEditingPhone(true);
  };

  const handleCancelEditPhone = () => {
    setIsEditingPhone(false);
    setPhoneNumber(userPhoneNumber || '');
    setPhoneError('');
  };

  const handleConfirm = async () => {
    if (isEditingPhone && !phoneNumber.trim()) {
      setPhoneError(t('validation.phoneRequired', 'Phone number is required'));
      return;
    }

    try {
      await onConfirm(isEditingPhone ? phoneNumber : undefined);
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
                      {t('agent.claimOrder.totalAmount', 'Total Amount', {
                        amount: formatCurrency(
                          order.total_amount,
                          order.currency
                        ),
                      })}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {formatCurrency(order.total_amount, order.currency)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('agent.claimOrder.deliveryEarnings', 'Your Earnings', {
                        deliveryFee: formatCurrency(
                          order.delivery_fee,
                          order.currency
                        ),
                      })}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color="success.main"
                    >
                      {formatCurrency(order.delivery_fee, order.currency)}
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
                      {t(
                        'agent.claimOrder.holdAmount',
                        'Hold Amount (80% of subtotal)',
                        { percentage: holdPercentage }
                      )}
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(holdAmount, order.currency)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t(
                        'agent.claimOrder.serviceCharge',
                        'Service Charge (3.5%)',
                        { percentage: chargePercentage }
                      )}
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(chargeAmount, order.currency)}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('agent.claimOrder.totalCharge', 'Total to be Charged')}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color="error.main"
                    >
                      {formatCurrency(totalChargeAmount, order.currency)}
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
              'To deliver an order you need to give us some guarantee which is a certain percentage of the value of the order. The more orders you complete, the more trust you build with the system and the hold amount will be reduced. Once the order is delivered, your account is credited with the delivery fee and your amount on hold is released.'
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
                {t('agent.claimOrder.phoneNumber', 'Phone Number')}
              </Typography>
            </Stack>
            {!isEditingPhone && userPhoneNumber && (
              <IconButton
                size="small"
                onClick={handleEditPhone}
                sx={{
                  bgcolor: 'primary.50',
                  '&:hover': { bgcolor: 'primary.100' },
                }}
              >
                <Edit fontSize="small" />
              </IconButton>
            )}
          </Stack>

          {isEditingPhone ? (
            <Stack spacing={2}>
              <PhoneInput
                value={phoneNumber}
                onChange={handlePhoneChange}
                label={t(
                  'agent.claimOrder.enterPhoneNumber',
                  'Enter phone number'
                )}
                error={!!phoneError}
                helperText={phoneError}
                defaultCountry="GA"
                fullWidth
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCancelEditPhone}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setIsEditingPhone(false)}
                  disabled={!phoneNumber.trim()}
                >
                  {t('common.save', 'Save')}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <TextField
              value={
                userPhoneNumber ||
                t('agent.claimOrder.noPhoneNumber', 'No phone number on file')
              }
              disabled
              fullWidth
              variant="outlined"
              size="small"
              sx={{
                '& .MuiInputBase-input': {
                  fontWeight: userPhoneNumber ? 'medium' : 'normal',
                  color: userPhoneNumber ? 'text.primary' : 'text.secondary',
                },
              }}
            />
          )}
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
              disabled={loading || (isEditingPhone && !phoneNumber.trim())}
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
  );
};

export default ClaimOrderDialog;
