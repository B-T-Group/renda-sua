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
import { useExportOrders } from '../../hooks/useExportOrders';

export default function ClientExportOrderDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { getOne, proformaAction, selectBalanceOption, confirmDelivery } =
    useExportOrders();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = await getOne(id);
    setOrder(data);
  }, [getOne, id]);

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
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontFamily: 'Georgia, serif' }}>
          {order.bc_number}
        </Typography>
        <Chip label={order.status} />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('exportOrders.detailHint', 'Documents and next actions for this export.')}
      </Typography>
      <Stack spacing={1} sx={{ mb: 3 }}>
        {(order.lines || []).map((line: any) => (
          <Typography key={line.id}>
            {line.quantity} × {line.product_name}
          </Typography>
        ))}
      </Stack>
      {(order.documents || []).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            {t('exportOrders.documents', 'Documents')}
          </Typography>
          {(order.documents || []).map((d: any) => (
            <Typography key={d.id} variant="body2">
              {d.doc_type} · {d.document_number}
            </Typography>
          ))}
        </Box>
      )}
      {order.status === 'PROFORMA_ISSUED' && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label={t('exportOrders.notes', 'Notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => run(() => proformaAction(id, 'approve'))}
            >
              {t('exportOrders.approveProforma', 'Approve proforma')}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(() => proformaAction(id, 'request_adjustment', notes))
              }
            >
              {t('exportOrders.requestAdjustment', 'Request adjustment')}
            </Button>
          </Stack>
        </Stack>
      )}
      {order.status === 'BALANCE_REQUIRED' && (
        <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => run(() => selectBalanceOption(id, 'FULL'))}
          >
            {t('exportOrders.payFull', 'Pay in full')}
          </Button>
          <Button
            disabled={busy}
            onClick={() => run(() => selectBalanceOption(id, 'FINANCED_30'))}
          >
            {t('exportOrders.finance30', 'Finance 30 days')}
          </Button>
          <Button
            disabled={busy}
            onClick={() => run(() => selectBalanceOption(id, 'FINANCED_60'))}
          >
            {t('exportOrders.finance60', 'Finance 60 days')}
          </Button>
        </Stack>
      )}
      {order.status === 'SHIPPED' && (
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => run(() => confirmDelivery(id))}
        >
          {t('exportOrders.confirmDelivery', 'Confirm delivery')}
        </Button>
      )}
    </Box>
  );
}
