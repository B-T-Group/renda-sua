import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';
import {
  type CreateRefundRequestBody,
  type RefundRequestReason,
  useOrderRefunds,
} from '../../hooks/useOrderRefunds';
import { RichTextEditor } from '../common/RichTextEditor';

const REASONS: { value: RefundRequestReason; key: string; def: string }[] = [
  { value: 'not_delivered', key: 'orders.refunds.reasons.notDelivered', def: 'Item was not delivered' },
  { value: 'wrong_item', key: 'orders.refunds.reasons.wrongItem', def: 'Wrong item' },
  { value: 'damaged', key: 'orders.refunds.reasons.damaged', def: 'Damaged item' },
  { value: 'quality_issue', key: 'orders.refunds.reasons.quality', def: 'Quality issue' },
  { value: 'missing_parts', key: 'orders.refunds.reasons.missingParts', def: 'Missing parts or accessories' },
  { value: 'other', key: 'orders.refunds.reasons.other', def: 'Other' },
];

function formatAddr(a: Record<string, unknown> | undefined): string {
  if (!a) {
    return '';
  }
  const parts = [
    a.address_line_1,
    a.address_line_2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(', '),
    a.country,
  ].filter(Boolean);
  return parts.join('\n');
}

interface ClientRefundRequestDialogProps {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

const ClientRefundRequestDialog: React.FC<ClientRefundRequestDialogProps> = ({
  open,
  onClose,
  order,
  onSuccess,
  onError,
}) => {
  const { t } = useTranslation();
  const { createRefundRequest, loading } = useOrderRefunds();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<RefundRequestReason>('other');
  const [notes, setNotes] = useState('');
  const [nextPayload, setNextPayload] = useState<{
    businessAddress: { address?: Record<string, unknown> } | null;
    itemSubtotal: number;
    deliveryFeeTotal: number;
    currency: string;
  } | null>(null);

  const deliveryTotal = useMemo(
    () =>
      (order.base_delivery_fee ?? 0) + (order.per_km_delivery_fee ?? 0),
    [order.base_delivery_fee, order.per_km_delivery_fee]
  );

  const reset = () => {
    setStep(0);
    setNotes('');
    setReason('other');
    setNextPayload(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const body: CreateRefundRequestBody = {
      reason,
      clientNotes: notes.trim() || undefined,
    };
    try {
      const data = await createRefundRequest(order.id, body);
      setNextPayload({
        businessAddress: data.businessAddress ?? null,
        itemSubtotal: data.itemSubtotal ?? order.subtotal ?? 0,
        deliveryFeeTotal: data.deliveryFeeTotal ?? deliveryTotal,
        currency: data.currency ?? order.currency,
      });
      setStep(1);
      onSuccess();
    } catch (e: any) {
      onError(e.message || 'Request failed');
    }
  };

  const addrText = formatAddr(nextPayload?.businessAddress?.address as Record<string, unknown>);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('orders.refunds.dialogTitle', 'Request a refund')}
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 2 }}>
          <Step>
            <StepLabel>
              {t('orders.refunds.stepRequest', 'Request')}
            </StepLabel>
          </Step>
          <Step>
            <StepLabel>
              {t('orders.refunds.stepNext', 'Next steps')}
            </StepLabel>
          </Step>
        </Stepper>

        {step === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'orders.refunds.policyHint',
                'You can request a refund within 3 days of delivery completion. Item refunds exclude the delivery fee unless the business decides otherwise.'
              )}
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="refund-reason-label">
                {t('orders.refunds.reasonLabel', 'Reason')}
              </InputLabel>
              <Select
                labelId="refund-reason-label"
                value={reason}
                label={t('orders.refunds.reasonLabel', 'Reason')}
                onChange={(e) =>
                  setReason(e.target.value as RefundRequestReason)
                }
              >
                {REASONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {t(r.key, r.def)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('orders.refunds.notesLabel', 'Additional details (optional)')}
              </Typography>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder={t(
                  'orders.refunds.notesPlaceholder',
                  'Describe the issue...'
                )}
              />
            </Box>
          </Box>
        )}

        {step === 1 && nextPayload && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1">
              {t('orders.refunds.nextStepsTitle', 'What happens next')}
            </Typography>
            <Typography variant="body2">
              {t(
                'orders.refunds.bringToBusiness',
                'Bring the item to the business registered address below for inspection. Refunds apply to the item total ({{amount}} {{currency}}), not the delivery fee ({{delivery}} {{currency}}), unless the business approves otherwise.',
                {
                  amount: nextPayload.itemSubtotal.toFixed(2),
                  currency: nextPayload.currency,
                  delivery: nextPayload.deliveryFeeTotal.toFixed(2),
                }
              )}
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {t('orders.refunds.businessAddress', 'Business address')}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {addrText ||
                  t(
                    'orders.refunds.noBusinessAddress',
                    'Address not on file. Contact the business.'
                  )}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step === 0 && (
          <>
            <Button onClick={handleClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
            >
              {t('orders.refunds.submit', 'Submit request')}
            </Button>
          </>
        )}
        {step === 1 && (
          <Button variant="contained" onClick={handleClose}>
            {t('common.done', 'Done')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ClientRefundRequestDialog;
