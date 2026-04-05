import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { translateRefundReason } from '../../utils/refundReasonTranslation';

interface PendingOrderItem {
  id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
}

interface PendingDeliveryAddress {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

interface PendingRow {
  id: string;
  reason: string;
  client_notes?: string | null;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    total_amount?: number | null;
    currency: string;
    current_status?: string;
    base_delivery_fee?: number | null;
    per_km_delivery_fee?: number | null;
    completed_at?: string | null;
    order_items?: PendingOrderItem[];
    delivery_address?: PendingDeliveryAddress | null;
    client?: {
      user?: {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
      } | null;
    } | null;
  };
}

function formatMoney(
  amount: number | null | undefined,
  currency: string
): string {
  if (amount == null || Number.isNaN(Number(amount))) {
    return '—';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number(amount));
}

function deliveryFeesSum(order: PendingRow['order']): number {
  return (order.base_delivery_fee ?? 0) + (order.per_km_delivery_fee ?? 0);
}

function formatDeliveryAddress(
  d: PendingDeliveryAddress | null | undefined
): string {
  if (!d) return '';
  const line2 = [d.city, d.state, d.postal_code].filter(Boolean).join(', ');
  const parts = [d.address_line_1, d.address_line_2, line2, d.country].filter(
    Boolean
  );
  return parts.join('\n');
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
        {rows.map((row) => {
          const c = row.order.client?.user;
          const clientName = [c?.first_name, c?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();
          const deliveryBlock = formatDeliveryAddress(row.order.delivery_address);
          const fees = deliveryFeesSum(row.order);
          const items = row.order.order_items ?? [];

          return (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ md: 'flex-start' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      flexWrap="wrap"
                      gap={1}
                      sx={{ mb: 1 }}
                    >
                      <Typography variant="subtitle1" fontWeight={700}>
                        {t('orders.refunds.orderNumber', 'Order {{n}}', {
                          n: row.order.order_number,
                        })}
                      </Typography>
                      {row.order.current_status && (
                        <Chip
                          size="small"
                          label={t(
                            `common.orderStatus.${row.order.current_status}`,
                            row.order.current_status
                          )}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>{t('orders.refunds.reasonLabel', 'Reason')}:</strong>{' '}
                      {translateRefundReason(row.reason, t)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('orders.refunds.requestedOn', 'Requested on')}:{' '}
                      {new Date(row.created_at).toLocaleString()}
                    </Typography>
                    {(clientName || c?.email) && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>
                          {t('orders.refunds.clientDetails', 'Client')}:
                        </strong>{' '}
                        {clientName || '—'}
                        {c?.email ? ` · ${c.email}` : ''}
                      </Typography>
                    )}
                    {row.client_notes?.trim() && (
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('orders.refunds.clientMessage', 'Client message')}
                        </Typography>
                        <Typography variant="body2">{row.client_notes}</Typography>
                      </Paper>
                    )}
                    <Stack spacing={0.5} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {t('orders.refunds.itemSubtotalLabel', 'Item subtotal')}:{' '}
                        <strong>
                          {formatMoney(row.order.subtotal, row.order.currency)}
                        </strong>
                      </Typography>
                      {fees > 0 && (
                        <Typography variant="body2">
                          {t('orders.refunds.deliveryFeesLabel', 'Delivery fees')}:{' '}
                          <strong>
                            {formatMoney(fees, row.order.currency)}
                          </strong>
                        </Typography>
                      )}
                      <Typography variant="body2">
                        {t('orders.refunds.totalLabel', 'Order total')}:{' '}
                        <strong>
                          {formatMoney(
                            row.order.total_amount ?? row.order.subtotal + fees,
                            row.order.currency
                          )}
                        </strong>
                      </Typography>
                    </Stack>
                    {deliveryBlock ? (
                      <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-line' }}>
                        <strong>{t('orders.refunds.deliverTo', 'Delivery address')}:</strong>
                        {'\n'}
                        {deliveryBlock}
                      </Typography>
                    ) : null}
                    {items.length > 0 && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          {t('orders.refunds.orderItemsHeading', 'Items in this order')}
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>
                                  {t('orders.confirmModal.items', 'Items')}
                                </TableCell>
                                <TableCell align="right">
                                  {t('orders.quantity', 'Quantity')}
                                </TableCell>
                                <TableCell align="right">
                                  {t('orders.refunds.lineTotal', 'Line total')}
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {items.map((line) => (
                                <TableRow key={line.id}>
                                  <TableCell>
                                    {line.item_name ?? '—'}
                                  </TableCell>
                                  <TableCell align="right">{line.quantity}</TableCell>
                                  <TableCell align="right">
                                    {formatMoney(
                                      line.total_price ?? line.unit_price,
                                      row.order.currency
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}
                    <Button
                      component={RouterLink}
                      to={`/orders/${row.order.id}`}
                      size="small"
                      sx={{ mt: 1.5 }}
                    >
                      {t('orders.refunds.viewOrder', 'View order')}
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      justifyContent: { xs: 'flex-start', md: 'flex-end' },
                    }}
                  >
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
                </Stack>
              </CardContent>
            </Card>
          );
        })}
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
          {active && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" color="text.secondary">
                {t('orders.refunds.orderNumber', 'Order {{n}}', {
                  n: active.order.order_number,
                })}{' '}
                · {translateRefundReason(active.reason, t)}
              </Typography>
              {active.client_notes?.trim() ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {active.client_notes}
                </Typography>
              ) : null}
            </Paper>
          )}
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
