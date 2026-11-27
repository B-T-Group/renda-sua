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
import { Link as RouterLink } from 'react-router-dom';
import { useExportOrders } from '../../hooks/useExportOrders';

export default function ClientExportOrdersPage() {
  const { t } = useTranslation();
  const { listMine } = useExportOrders();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listMine(1, 50);
        if (!cancelled) setItems(data?.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listMine]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 1, fontFamily: 'Georgia, serif' }}>
        {t('exportOrders.myOrders', 'My export orders')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'exportOrders.myOrdersHint',
          'Track bon de commande, proforma approval, and delivery.'
        )}
      </Typography>
      <Stack spacing={2}>
        {items.length === 0 && (
          <Typography>
            {t('exportOrders.empty', 'No export orders yet.')}{' '}
            <Button component={RouterLink} to="/exports" size="small">
              {t('exportOrders.browse', 'Browse exports')}
            </Button>
          </Typography>
        )}
        {items.map((row) => (
          <Box
            key={row.id}
            sx={{
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography fontWeight={600}>
                {row.bc_number || row.id.slice(0, 8)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.business?.name || '—'} ·{' '}
                {new Date(row.created_at).toLocaleDateString()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={row.status} />
              <Button
                component={RouterLink}
                to={`/export-orders/${row.id}`}
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
