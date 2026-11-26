import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useExportOrders } from '../../hooks/useExportOrders';

export default function BusinessExportOrdersPage() {
  const { t } = useTranslation();
  const { listBusiness } = useExportOrders();
  const api = useApiClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    const data = await listBusiness();
    setItems(data?.items ?? []);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markReady = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/business/export-orders/${id}/mark-ready`);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 2, fontFamily: 'Georgia, serif' }}>
        {t('exportOrders.manufacturerTitle', 'Manufacturer export orders')}
      </Typography>
      <Stack spacing={1.5}>
        {items.map((row) => (
          <Box
            key={row.id}
            sx={{
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography fontWeight={600}>{row.bc_number}</Typography>
              <Chip size="small" label={row.status} sx={{ mt: 0.5 }} />
            </Box>
            {row.status === 'IN_PRODUCTION' && (
              <Button
                size="small"
                variant="contained"
                disabled={busyId === row.id}
                onClick={() => markReady(row.id)}
              >
                {t('exportOrders.markReady', 'Mark ready')}
              </Button>
            )}
          </Box>
        ))}
        {items.length === 0 && (
          <Typography color="text.secondary">
            {t('exportOrders.mfrEmpty', 'No export orders yet.')}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
