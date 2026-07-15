import {
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import type { TransferRequest } from '../../hooks/useLocationTransfers';
import SEOHead from '../seo/SEOHead';

const STATUS_COLORS: Record<
  string,
  'default' | 'warning' | 'success' | 'error' | 'info'
> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'error',
  cancelled: 'default',
  expired: 'info',
};

const AdminLocationTransfersPage: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [items, setItems] = useState<TransferRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const { data } = await apiClient.get(
        `/admin/location-transfers?${params.toString()}`
      );
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to load');
      }
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [apiClient, page, limit, status, search]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const cancelRequest = async (id: string) => {
    if (!apiClient) return;
    setBusyId(id);
    try {
      await apiClient.post(`/admin/location-transfers/${id}/cancel`);
      await fetchRows();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <SEOHead
        title={t(
          'admin.locationTransfers.title',
          'Location transfers'
        )}
        description={t(
          'admin.locationTransfers.description',
          'View and manage business location transfer requests'
        )}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        mb={3}
      >
        <Typography variant="h4" fontWeight={700}>
          {t('admin.locationTransfers.title', 'Location transfers')}
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => void fetchRows()}
          variant="outlined"
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            label={t('common.search', 'Search')}
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            fullWidth
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>
              {t('admin.locationTransfers.status', 'Status')}
            </InputLabel>
            <Select
              label={t('admin.locationTransfers.status', 'Status')}
              value={status}
              onChange={(e) => {
                setPage(0);
                setStatus(e.target.value);
              }}
            >
              <MenuItem value="">
                {t('common.all', 'All')}
              </MenuItem>
              {['pending', 'accepted', 'rejected', 'cancelled', 'expired'].map(
                (s) => (
                  <MenuItem key={s} value={s}>
                    {t(`admin.locationTransfers.statuses.${s}`, s)}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.locationTransfers.location', 'Location')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.mode', 'Mode')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.from', 'From')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.to', 'To')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.status', 'Status')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.counts', 'Counts')}
                  </TableCell>
                  <TableCell>
                    {t('admin.locationTransfers.created', 'Created')}
                  </TableCell>
                  <TableCell align="right">
                    {t('common.actions', 'Actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      {row.business_location?.name ||
                        String(row.metadata?.locationName || '—')}
                      {row.transfer_mode === 'inventory_merge' &&
                        (row.to_business_location?.name ||
                          row.metadata?.toLocationName) && (
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            →{' '}
                            {row.to_business_location?.name ||
                              String(row.metadata?.toLocationName)}
                          </Typography>
                        )}
                    </TableCell>
                    <TableCell>
                      {row.transfer_mode === 'inventory_merge'
                        ? t(
                            'admin.locationTransfers.modes.inventory_merge',
                            'Inventory merge'
                          )
                        : t(
                            'admin.locationTransfers.modes.location_ownership',
                            'Ownership'
                          )}
                    </TableCell>
                    <TableCell>{row.from_business?.name || '—'}</TableCell>
                    <TableCell>{row.to_business?.name || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(
                          `admin.locationTransfers.statuses.${row.status}`,
                          row.status
                        )}
                        color={STATUS_COLORS[row.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {row.item_count}i / {row.rental_item_count}r /{' '}
                      {row.order_count}o
                    </TableCell>
                    <TableCell>
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {row.status === 'pending' && (
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<CancelIcon />}
                          disabled={busyId === row.id}
                          onClick={() => void cancelRequest(row.id)}
                        >
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" py={3}>
                        {t(
                          'admin.locationTransfers.empty',
                          'No transfer requests found'
                        )}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={limit}
              onRowsPerPageChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default AdminLocationTransfersPage;
