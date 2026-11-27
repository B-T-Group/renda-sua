import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useExportOrders } from '../../../hooks/useExportOrders';
import { ExportOrderStatusChip } from '../../common/ExportOrderStatusChip';

export default function AdminExportOrdersPage() {
  const { t } = useTranslation();
  const { listAdmin, dashboard } = useExportOrders();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, dash] = await Promise.all([
          listAdmin(1, 50, status || undefined),
          dashboard(),
        ]);
        if (!cancelled) {
          setItems(list?.items ?? []);
          setSummary(dash);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listAdmin, dashboard, status]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, fontFamily: 'Georgia, serif' }}>
        {t('exportOrders.adminTitle', 'Export orders')}
      </Typography>
      {summary && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('exportOrders.totalOrders', 'Total')}: {summary.totalOrders} · AR
          deposits {summary.accountsReceivable?.deposits ?? 0} · Financing{' '}
          {summary.openFinancing ?? 0}
        </Typography>
      )}
      <TextField
        select
        size="small"
        label={t('exportOrders.status', 'Status')}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        sx={{ mb: 2, minWidth: 220 }}
      >
        <MenuItem value="">{t('common.all', 'All')}</MenuItem>
        {[
          'SUBMITTED',
          'IN_REVIEW',
          'MFR_QUOTE',
          'PROFORMA_ISSUED',
          'DEPOSIT_REQUIRED',
          'IN_PRODUCTION',
          'SHIPPED',
        ].map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
      <Stack spacing={1.5}>
        {items.map((row) => (
          <Box
            key={row.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography fontWeight={600}>{row.bc_number}</Typography>
              <Typography variant="body2" color="text.secondary">
                {row.client_user?.first_name} {row.client_user?.last_name} ·{' '}
                {row.country_code}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <ExportOrderStatusChip size="small" status={row.status} />
              <Button
                component={RouterLink}
                to={`/admin/export-orders/${row.id}`}
                size="small"
              >
                {t('common.open', 'Open')}
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
