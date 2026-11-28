import {
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useExportOrders } from '../../hooks/useExportOrders';
import { ExportOrderStatusChip } from '../common/ExportOrderStatusChip';
import { ExportOrderActions } from '../export-orders/ExportOrderActions';
import { ExportOrderNextStepCard } from '../export-orders/ExportOrderNextStepCard';
import { ExportOrderProgress } from '../export-orders/ExportOrderProgress';
import { exportOrderDocLabel } from '../../utils/exportOrders/exportOrderProgress';

export default function ClientExportOrderDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { getOne, proformaAction, selectBalanceOption, confirmDelivery } =
    useExportOrders();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    const data = await getOne(id);
    setOrder(data);
  }, [getOne, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setLoadFailed(true);
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

  if (loadFailed) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          {t('exportOrders.loadError', 'Could not load your export orders')}
        </Typography>
      </Box>
    );
  }

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
        <ExportOrderStatusChip status={order.status} />
      </Stack>
      <ExportOrderNextStepCard status={order.status}>
        <ExportOrderActions
          status={order.status}
          busy={busy}
          onApprove={() => run(() => proformaAction(id, 'approve'))}
          onRequestAdjustment={(notes) =>
            run(() => proformaAction(id, 'request_adjustment', notes))
          }
          onBalanceOption={(option) => run(() => selectBalanceOption(id, option))}
          onConfirmDelivery={() => run(() => confirmDelivery(id))}
        />
      </ExportOrderNextStepCard>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography fontWeight={600}>
          {t('exportOrders.lines', 'Items')}
        </Typography>
        {(order.lines || []).map((line: any) => (
          <Typography key={line.id}>
            {line.quantity} × {line.product_name}
          </Typography>
        ))}
      </Stack>
      <ExportOrderProgress status={order.status} />
      {(order.documents || []).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            {t('exportOrders.documents', 'Documents')}
          </Typography>
          {(order.documents || []).map((d: any) => (
            <Typography key={d.id} variant="body2">
              {t(
                `exportOrders.docTypes.${d.doc_type}`,
                exportOrderDocLabel(d.doc_type)
              )}{' '}
              · {d.document_number}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
