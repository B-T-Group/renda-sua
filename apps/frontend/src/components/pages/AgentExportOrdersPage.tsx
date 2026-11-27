import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useExportOrders } from '../../hooks/useExportOrders';
import { ExportOrderStatusChip } from '../common/ExportOrderStatusChip';

export default function AgentExportOrdersPage() {
  const { t } = useTranslation();
  const { listAgent } = useExportOrders();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listAgent();
        if (!cancelled) setItems(data?.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listAgent]);

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
        {t('exportOrders.agentTitle', 'Client export orders')}
      </Typography>
      <Stack spacing={1.5}>
        {items.map((row) => (
          <Box
            key={row.id}
            component={RouterLink}
            to={`/export-orders/${row.id}`}
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Typography fontWeight={600}>{row.bc_number}</Typography>
            <ExportOrderStatusChip size="small" status={row.status} />
          </Box>
        ))}
        {items.length === 0 && (
          <Typography color="text.secondary">
            {t('exportOrders.agentEmpty', 'No export orders for your clients yet.')}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
