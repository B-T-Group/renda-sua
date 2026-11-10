import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useApiClient } from '../../hooks/useApiClient';
import { usePermission } from '../../hooks/usePermissions';

interface DisputeRow {
  id: string;
  rental_booking_id: string;
  status: string;
  reason?: string | null;
  opened_at?: string | null;
  sla_due_at?: string | null;
  rental_booking?: {
    booking_number?: string | null;
    status?: string | null;
    settlement_attention?: string | null;
    return_resolution?: string | null;
    rental_location_listing?: { rental_item?: { name?: string | null } | null } | null;
  } | null;
}

const AdminInspectionDisputesPage: React.FC = () => {
  const { t } = useTranslation();
  const allowed = usePermission(PlatformPermissions.MODERATE_RENTALS);
  const api = useApiClient();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DisputeRow[]>('/admin/rentals/inspection-disputes');
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('rentalInspection.loadFailed', 'Could not load the inspection.'));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error" variant="h6">
          {t('rentalInspection.adminDenied', 'Access denied')}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('rentalInspection.adminListTitle', 'Inspection disputes')}</Typography>
        <Button onClick={() => void load()} sx={{ minHeight: 48 }}>{t('common.refresh', 'Refresh')}</Button>
      </Box>
      {error ? <Typography color="error">{error}</Typography> : null}
      {loading ? <CircularProgress /> : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('rentalInspection.adminBooking', 'Booking')}</TableCell>
              <TableCell>{t('rentalInspection.adminItem', 'Item')}</TableCell>
              <TableCell>{t('rentalInspection.adminStatus', 'Status')}</TableCell>
              <TableCell>{t('rentalInspection.adminAttention', 'Settlement attention')}</TableCell>
              <TableCell>{t('rentalInspection.adminSla', 'Review due')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.rental_booking?.booking_number || row.rental_booking_id}</TableCell>
                <TableCell>{row.rental_booking?.rental_location_listing?.rental_item?.name || '—'}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.rental_booking?.settlement_attention ? (
                    <Chip color="warning" label={row.rental_booking.settlement_attention} />
                  ) : '—'}
                </TableCell>
                <TableCell>{row.sla_due_at ? new Date(row.sla_due_at).toLocaleString() : '—'}</TableCell>
                <TableCell>
                  <Button component={RouterLink} to={`/admin/rental-inspections/${row.rental_booking_id}`} sx={{ minHeight: 48 }}>
                    {t('rentalInspection.adminOpen', 'Open')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>{t('rentalInspection.adminEmpty', 'No open inspection reviews.')}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Container>
  );
};

export default AdminInspectionDisputesPage;
