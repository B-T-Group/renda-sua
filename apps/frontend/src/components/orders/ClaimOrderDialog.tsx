import { Edit, Phone } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
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
    } catch (error) {
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Phone color="primary" />
          <Typography variant="h6">
            {t('agent.claimOrder.title', 'Claim Order with Payment')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        ) : success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'agent.claimOrder.successMessage',
                'Payment request sent successfully! Please check your phone and accept the payment request to claim the order.'
              )}
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'agent.claimOrder.info',
                'A payment request will be sent to your phone number. Once you accept the payment request, the order will be automatically claimed by you.'
              )}
            </Typography>
          </Alert>
        )}

        <Box mb={2}>
          <Typography variant="subtitle1" gutterBottom>
            {t('agent.claimOrder.orderDetails', 'Order Details')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('agent.claimOrder.orderNumber', 'Order #{{orderNumber}}', {
              orderNumber: order.order_number,
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('agent.claimOrder.totalAmount', 'Total Amount: {{amount}}', {
              amount: formatCurrency(order.total_amount, order.currency),
            })}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box mb={2}>
          <Typography variant="subtitle1" gutterBottom>
            {t('agent.claimOrder.paymentDetails', 'Payment Details')}
          </Typography>

          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">
              {t(
                'agent.claimOrder.holdAmount',
                'Hold Amount ({{percentage}}%)',
                {
                  percentage: holdPercentage,
                }
              )}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatCurrency(holdAmount, order.currency)}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">
              {t(
                'agent.claimOrder.serviceCharge',
                'Service Charge ({{percentage}}%)',
                {
                  percentage: chargePercentage,
                }
              )}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatCurrency(chargeAmount, order.currency)}
            </Typography>
          </Box>

          <Divider sx={{ my: 1 }} />

          <Box display="flex" justifyContent="space-between">
            <Typography variant="subtitle2" fontWeight="bold">
              {t('agent.claimOrder.totalCharge', 'Total Charge')}
            </Typography>
            <Typography variant="subtitle2" fontWeight="bold" color="primary">
              {formatCurrency(totalChargeAmount, order.currency)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box mb={2}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Typography variant="subtitle1">
              {t('agent.claimOrder.phoneNumber', 'Phone Number')}
            </Typography>
            {!isEditingPhone && (
              <IconButton size="small" onClick={handleEditPhone}>
                <Edit fontSize="small" />
              </IconButton>
            )}
          </Box>

          {isEditingPhone ? (
            <Box>
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
              <Box display="flex" gap={1} mt={1}>
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
              </Box>
            </Box>
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
            />
          )}
        </Box>

        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {t(
              'agent.claimOrder.deliveryEarnings',
              'You will earn {{deliveryFee}} in delivery fees from this order.',
              {
                deliveryFee: formatCurrency(order.delivery_fee, order.currency),
              }
            )}
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        {success || error ? (
          <Button onClick={onClose} variant="contained" color="primary">
            {t('common.close', 'Close')}
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={loading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              disabled={loading || (isEditingPhone && !phoneNumber.trim())}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading
                ? t('agent.claimOrder.processing', 'Processing...')
                : t('agent.claimOrder.confirmClaim', 'Confirm & Claim Order')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ClaimOrderDialog;
