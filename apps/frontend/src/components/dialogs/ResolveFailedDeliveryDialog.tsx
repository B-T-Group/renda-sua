import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FailedDelivery,
  useFailedDeliveries,
} from '../../hooks/useFailedDeliveries';

interface ResolveFailedDeliveryDialogProps {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onResolve: (
    orderId: string,
    resolution: {
      resolution_type: 'agent_fault' | 'client_fault' | 'item_fault';
      outcome: string;
      restore_inventory?: boolean;
    }
  ) => Promise<void>;
}

const ResolveFailedDeliveryDialog: React.FC<
  ResolveFailedDeliveryDialogProps
> = ({ open, orderId, onClose, onResolve }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getFailedDelivery, loading } = useFailedDeliveries();

  const [failedDelivery, setFailedDelivery] = useState<FailedDelivery | null>(
    null
  );
  const [resolutionType, setResolutionType] = useState<
    'agent_fault' | 'client_fault' | 'item_fault' | ''
  >('');
  const [outcome, setOutcome] = useState('');
  const [restoreInventory, setRestoreInventory] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      loadFailedDelivery();
    } else {
      // Reset form when dialog closes
      setResolutionType('');
      setOutcome('');
      setRestoreInventory(true);
      setFailedDelivery(null);
    }
  }, [open, orderId]);

  const loadFailedDelivery = async () => {
    try {
      const delivery = await getFailedDelivery(orderId);
      setFailedDelivery(delivery);
    } catch (err: any) {
      console.error('Error loading failed delivery:', err);
      enqueueSnackbar(
        t(
          'business.failedDeliveries.loadError',
          'Failed to load delivery details'
        ),
        { variant: 'error' }
      );
      onClose();
    }
  };

  const handleResolve = async () => {
    if (!resolutionType || !outcome.trim()) {
      enqueueSnackbar(
        t(
          'business.failedDeliveries.validationError',
          'Please select a resolution type and provide an outcome description'
        ),
        { variant: 'warning' }
      );
      return;
    }

    setResolving(true);
    try {
      await onResolve(orderId, {
        resolution_type: resolutionType as
          | 'agent_fault'
          | 'client_fault'
          | 'item_fault',
        outcome: outcome.trim(),
        restore_inventory:
          resolutionType === 'item_fault' ? restoreInventory : undefined,
      });
    } catch (err: any) {
      // Error handling is done in parent component
    } finally {
      setResolving(false);
    }
  };

  const getResolutionDescription = (
    type: 'agent_fault' | 'client_fault' | 'item_fault'
  ) => {
    switch (type) {
      case 'agent_fault':
        return t(
          'business.failedDeliveries.resolutionDescription.agent_fault',
          'Client will be refunded. Agent hold will be released and deposited to your business account.'
        );
      case 'item_fault':
        return t(
          'business.failedDeliveries.resolutionDescription.item_fault',
          'Both client and agent will be refunded. Inventory can optionally be restored.'
        );
      case 'client_fault':
        return t(
          'business.failedDeliveries.resolutionDescription.client_fault',
          'Both client and agent will be refunded. Client will be charged 2x cancellation fee (split 50/50 between agent and business).'
        );
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t(
          'business.failedDeliveries.resolveDialog.title',
          'Resolve Failed Delivery'
        )}
      </DialogTitle>
      <DialogContent>
        {loading && !failedDelivery ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography>{t('common.loading', 'Loading...')}</Typography>
          </Box>
        ) : failedDelivery ? (
          <Stack spacing={3}>
            {/* Order Information */}
            <Box>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                {t('business.failedDeliveries.orderInfo', 'Order Information')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.failedDeliveries.orderNumber',
                  'Order #{{orderNumber}}',
                  {
                    orderNumber: failedDelivery.order.order_number,
                  }
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('business.failedDeliveries.amount', 'Amount')}:{' '}
                {failedDelivery.order.total_amount.toFixed(2)}{' '}
                {failedDelivery.order.currency}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.failedDeliveries.failureReason',
                  'Failure Reason: {{reason}}',
                  {
                    reason:
                      failedDelivery.failure_reason.reason_fr ||
                      failedDelivery.failure_reason.reason_en,
                  }
                )}
              </Typography>
            </Box>

            {/* Resolution Type Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                {t(
                  'business.failedDeliveries.selectResolutionType',
                  'Select Resolution Type'
                )}
              </Typography>
              <RadioGroup
                value={resolutionType}
                onChange={(e) =>
                  setResolutionType(
                    e.target.value as
                      | 'agent_fault'
                      | 'client_fault'
                      | 'item_fault'
                      | ''
                  )
                }
              >
                <FormControlLabel
                  value="agent_fault"
                  control={<Radio />}
                  label={t(
                    'business.failedDeliveries.resolutionType.agent_fault',
                    'Agent Fault'
                  )}
                />
                <FormControlLabel
                  value="item_fault"
                  control={<Radio />}
                  label={t(
                    'business.failedDeliveries.resolutionType.item_fault',
                    'Item Fault'
                  )}
                />
                <FormControlLabel
                  value="client_fault"
                  control={<Radio />}
                  label={t(
                    'business.failedDeliveries.resolutionType.client_fault',
                    'Client Fault'
                  )}
                />
              </RadioGroup>
            </Box>

            {/* Resolution Description */}
            {resolutionType && (
              <Alert severity="info">
                {getResolutionDescription(
                  resolutionType as
                    | 'agent_fault'
                    | 'client_fault'
                    | 'item_fault'
                )}
              </Alert>
            )}

            {/* Restore Inventory Checkbox (for item_fault only) */}
            {resolutionType === 'item_fault' && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreInventory}
                    onChange={(e) => setRestoreInventory(e.target.checked)}
                  />
                }
                label={t(
                  'business.failedDeliveries.restoreInventory',
                  'Restore inventory quantities'
                )}
              />
            )}

            {/* Outcome Text Field */}
            <TextField
              label={t(
                'business.failedDeliveries.outcomeLabel',
                'Resolution Outcome (Required)'
              )}
              multiline
              rows={4}
              fullWidth
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder={t(
                'business.failedDeliveries.outcomePlaceholder',
                'Describe how this failed delivery was resolved...'
              )}
              required
            />
          </Stack>
        ) : (
          <Alert severity="error">
            {t(
              'business.failedDeliveries.loadError',
              'Failed to load delivery details'
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={resolving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleResolve}
          variant="contained"
          disabled={
            resolving ||
            !resolutionType ||
            !outcome.trim() ||
            loading ||
            !failedDelivery
          }
        >
          {resolving
            ? t('common.resolving', 'Resolving...')
            : t('business.failedDeliveries.resolve', 'Resolve')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResolveFailedDeliveryDialog;

