import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  useOrderRefunds,
  type ApproveFullBody,
  type ApprovePartialBody,
  type ApproveReplaceBody,
} from '../../hooks/useOrderRefunds';
import SEOHead from '../seo/SEOHead';

interface PendingRow {
  id: string;
  reason: string;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    currency: string;
  };
}

const BusinessRefundRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    listRefundRequests,
    approveFull,
    approvePartial,
    approveReplaceItem,
    rejectRefund,
    loading,
  } = useOrderRefunds();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<PendingRow | null>(null);
  const [mode, setMode] = useState<'full' | 'partial' | 'replace' | 'reject' | null>(
    null
  );
  const [inspection, setInspection] = useState(true);
  const [refundDelivery, setRefundDelivery] = useState(false);
  const [partialAmt, setPartialAmt] = useState('');
  const [bizNote, setBizNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await listRefundRequests();
      setRows((data.refundRequests ?? []) as PendingRow[]);
    } catch (e: any) {
      setErr(e.message);
    }
  }, [listRefundRequests]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = () => {
    setActive(null);
    setMode(null);
    setPartialAmt('');
    setBizNote('');
    setRejectReason('');
    setRefundDelivery(false);
    setInspection(true);
  };

  const submit = async () => {
    if (!active || !mode) {
      return;
    }
    const oid = active.order.id;
    try {
      if (mode === 'full') {
        const body: ApproveFullBody = {
          inspectionAcknowledged: inspection,
          refundDeliveryFee: refundDelivery,
          businessNote: bizNote.trim() || undefined,
        };
        await approveFull(oid, body);
      } else if (mode === 'partial') {
        const amt = parseFloat(partialAmt);
        const body: ApprovePartialBody = {
          amount: amt,
          inspectionAcknowledged: inspection,
          businessNote: bizNote.trim() || undefined,
        };
        await approvePartial(oid, body);
      } else if (mode === 'replace') {
        const body: ApproveReplaceBody = {
          inspectionAcknowledged: inspection,
          businessNote: bizNote.trim() || undefined,
        };
        await approveReplaceItem(oid, body);
      } else {
        await rejectRefund(oid, {
          rejectionReason: rejectReason.trim(),
        });
      }
      closeDialog();
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <SEOHead title={t('orders.refunds.businessTitle', 'Refund requests')} />
      <Typography variant="h5" gutterBottom>
        {t('orders.refunds.businessTitle', 'Refund requests')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'orders.refunds.businessSubtitle',
          'Review open client refund requests. Inspect returned items before approving.'
        )}
      </Typography>
      {err && (
        <Typography color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      )}
      {rows.length === 0 && !loading && (
        <Typography variant="body2">
          {t('orders.refunds.empty', 'No pending refund requests.')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row) => (
          <Card key={row.id} variant="outlined">
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="subtitle1">
                  {t('orders.refunds.orderNumber', 'Order {{n}}', {
                    n: row.order.order_number,
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.reason} · {new Date(row.created_at).toLocaleString()}
                </Typography>
                <Button
                  component={RouterLink}
                  to={`/orders/${row.order.id}`}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('orders.refunds.viewOrder', 'View order')}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={() => {
                    setActive(row);
                    setMode('full');
                  }}
                >
                  {t('orders.refunds.approveFull', 'Approve full')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setActive(row);
                    setMode('partial');
                  }}
                >
                  {t('orders.refunds.approvePartial', 'Partial')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setActive(row);
                    setMode('replace');
                  }}
                >
                  {t('orders.refunds.replaceItem', 'Replace item')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setActive(row);
                    setMode('reject');
                  }}
                >
                  {t('orders.refunds.reject', 'Reject')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={!!active && !!mode} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {mode === 'full' &&
            t('orders.refunds.dialogApproveFull', 'Approve full refund')}
          {mode === 'partial' &&
            t('orders.refunds.dialogApprovePartial', 'Approve partial refund')}
          {mode === 'replace' &&
            t('orders.refunds.dialogApproveReplace', 'Approve item replacement')}
          {mode === 'reject' &&
            t('orders.refunds.dialogReject', 'Reject refund request')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {active && mode !== 'reject' && mode !== 'replace' && (
            <>
              <Typography variant="body2">
                {t('orders.refunds.itemSubtotalLabel', 'Item subtotal')}:{' '}
                <strong>
                  {active.order.subtotal} {active.order.currency}
                </strong>
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={inspection}
                    onChange={(e) => setInspection(e.target.checked)}
                  />
                }
                label={t(
                  'orders.refunds.inspectionLabel',
                  'I have inspected the returned item'
                )}
              />
            </>
          )}
          {active && mode === 'replace' && (
            <>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'orders.refunds.replaceExplanation',
                  'You will replace the item and arrange delivery to the client at no delivery charge. No wallet refund is issued for this resolution.'
                )}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={inspection}
                    onChange={(e) => setInspection(e.target.checked)}
                  />
                }
                label={t(
                  'orders.refunds.inspectionLabel',
                  'I have inspected the returned item'
                )}
              />
            </>
          )}
          {mode === 'full' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={refundDelivery}
                  onChange={(e) => setRefundDelivery(e.target.checked)}
                />
              }
              label={t(
                'orders.refunds.refundDeliveryToo',
                'Also refund delivery fees'
              )}
            />
          )}
          {mode === 'partial' && (
            <TextField
              label={t('orders.refunds.partialAmount', 'Refund amount (items)')}
              type="number"
              fullWidth
              value={partialAmt}
              onChange={(e) => setPartialAmt(e.target.value)}
              inputProps={{ min: 0.01, step: 0.01 }}
              helperText={t(
                'orders.refunds.partialHint',
                'Must be greater than 0 and less than the item subtotal.'
              )}
            />
          )}
          {mode === 'reject' && (
            <TextField
              label={t('orders.refunds.rejectionReason', 'Rejection reason')}
              fullWidth
              multiline
              minRows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
          )}
          {mode !== 'reject' && (
            <TextField
              label={t('orders.refunds.businessNote', 'Internal note (optional)')}
              fullWidth
              multiline
              minRows={2}
              value={bizNote}
              onChange={(e) => setBizNote(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={
              loading ||
              (mode !== 'reject' && !inspection) ||
              (mode === 'reject' && !rejectReason.trim()) ||
              (mode === 'partial' &&
                (!partialAmt || parseFloat(partialAmt) <= 0))
            }
          >
            {t('common.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BusinessRefundRequestsPage;
