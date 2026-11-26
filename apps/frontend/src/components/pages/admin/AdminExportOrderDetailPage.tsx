import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useExportOrders } from '../../../hooks/useExportOrders';

export default function AdminExportOrderDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { getAdminOne, adminReview, issueProforma, recordPayment } =
    useExportOrders();
  const [order, setOrder] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setOrder(await getAdminOne(id));
  }, [getAdminOne, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !order) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontFamily: 'Georgia, serif' }}>
          {order.bc_number}
        </Typography>
        <Chip label={order.status} />
      </Stack>
      <Typography sx={{ mb: 2 }} color="text.secondary">
        {order.client_user?.email} · {order.business?.name}
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={2}
        label={t('exportOrders.notes', 'Notes')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        sx={{ mb: 2 }}
      />
      {(order.status === 'SUBMITTED' || order.status === 'IN_REVIEW') && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => run(() => adminReview(id, 'APPROVE', notes))}
          >
            {t('exportOrders.approve', 'Approve → manufacturer')}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              run(() => adminReview(id, 'CHANGES_REQUESTED', notes || 'Changes'))
            }
          >
            {t('exportOrders.requestChanges', 'Request changes')}
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() =>
              run(() => adminReview(id, 'REJECT', notes || 'Rejected'))
            }
          >
            {t('exportOrders.reject', 'Reject')}
          </Button>
        </Stack>
      )}
      {(order.status === 'MFR_QUOTE' || order.status === 'PROFORMA_ISSUED') && (
        <Button
          variant="contained"
          disabled={busy || !(order.lines || []).length}
          sx={{ mb: 2 }}
          onClick={() =>
            run(() =>
              issueProforma(id, {
                lines: (order.lines || []).map((l: any) => ({
                  lineId: l.id,
                  unitPrice: Number(l.unit_price || 100),
                  manufacturerUnitCost: Number(l.manufacturer_unit_cost || 60),
                })),
                depositRate: 0.4,
                validityDays: 7,
              })
            )
          }
        >
          {t('exportOrders.issueProforma', 'Issue proforma (default prices)')}
        </Button>
      )}
      {order.status === 'DEPOSIT_REQUIRED' && (
        <Button
          variant="contained"
          disabled={busy}
          onClick={() =>
            run(() =>
              recordPayment(id, {
                amount: Number(order.deposit_amount || 0),
                allocation: 'deposit',
                method: 'wire',
                reference: 'MANUAL',
              })
            )
          }
        >
          {t('exportOrders.recordDeposit', 'Record deposit payment')}
        </Button>
      )}
    </Box>
  );
}
