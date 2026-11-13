import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useApiClient } from '../../hooks/useApiClient';
import { usePermission } from '../../hooks/usePermissions';
import { bookingDetailStatusLabelKey } from '../../utils/rentalPhase';
import { formatAdminDoualaTime } from '../../utils/adminDoualaTime';
import { formatListingDue } from '../../utils/rentalRequestFormat';

interface NotReceivedRow {
  id: string;
  rental_booking_id: string;
  reported_at?: string | null;
  rental_booking?: {
    booking_number?: string | null;
    status?: string | null;
    rental_location_listing?: { rental_item?: { name?: string | null } | null } | null;
  } | null;
}

interface ReturnReportRow {
  id: string;
  booking_number?: string | null;
  status?: string | null;
  renter_reported_returned_at?: string | null;
  renter_return_escalated_at?: string | null;
  rental_location_listing?: {
    rental_item?: { name?: string | null } | null;
    business_location?: { name?: string | null } | null;
  } | null;
}

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
  const { t, i18n } = useTranslation();
  const allowed = usePermission(PlatformPermissions.MODERATE_RENTALS);
  const api = useApiClient();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [reports, setReports] = useState<NotReceivedRow[]>([]);
  const [returns, setReturns] = useState<ReturnReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DisputeRow[]>('/admin/rentals/inspection-disputes');
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('rentalInspection.loadFailed', 'Could not load the inspection.'));
    }
    try {
      const { data } = await api.get<NotReceivedRow[]>('/admin/rentals/not-received-reports');
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    }
    try {
      const { data } = await api.get<ReturnReportRow[]>('/admin/rentals/return-reports');
      setReturns(Array.isArray(data) ? data : []);
    } catch {
      setReturns([]);
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
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5">{t('rentalInspection.adminNotReceivedTitle', 'Item not received')}</Typography>
        <Typography sx={{ mt: 1, mb: 2 }}>
          {t(
            'rentalInspection.adminNotReceivedHint',
            "Renters who say the item wasn't handed over after start."
          )}
        </Typography>
        {loading ? null : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('rentalInspection.adminBooking', 'Booking')}</TableCell>
                <TableCell>{t('rentalInspection.adminItem', 'Item')}</TableCell>
                <TableCell>{t('rentalInspection.adminStatus', 'Status')}</TableCell>
                <TableCell>{t('rentalInspection.adminNotReceivedWhen', 'Reported')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.rental_booking?.booking_number || row.rental_booking_id}</TableCell>
                  <TableCell>{row.rental_booking?.rental_location_listing?.rental_item?.name || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={
                        row.rental_booking?.status
                          ? t(
                              bookingDetailStatusLabelKey(row.rental_booking.status),
                              row.rental_booking.status
                            )
                          : '—'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {row.reported_at ? formatListingDue(row.reported_at, i18n.language) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button component={RouterLink} to={`/admin/rental-inspections/${row.rental_booking_id}`} sx={{ minHeight: 48 }}>
                      {t('rentalInspection.adminOpen', 'Open')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>{t('rentalInspection.adminEmpty', 'No open inspection reviews.')}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Box>
      <Box sx={{ mt: 4 }} data-testid="admin-return-reports">
        <Typography variant="h5">{t('rentals.returnReport.adminTitle', 'Renter return reports')}</Typography>
        <Typography sx={{ mt: 1, mb: 2 }}>
          {t(
            'rentals.returnReport.adminHint',
            'The renter says the item is back. Status and the deposit stay unchanged until you or the business confirm.'
          )}
        </Typography>
        {loading ? null : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('rentalInspection.adminBooking', 'Booking')}</TableCell>
                <TableCell>{t('rentalInspection.adminItem', 'Item')}</TableCell>
                <TableCell>{t('rentalInspection.adminStatus', 'Status')}</TableCell>
                <TableCell>{t('rentalInspection.adminNotReceivedWhen', 'Reported')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {returns.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.booking_number || row.id}</TableCell>
                  <TableCell>{row.rental_location_listing?.rental_item?.name || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      color={row.renter_return_escalated_at ? 'warning' : 'default'}
                      label={
                        row.renter_return_escalated_at
                          ? t('rentals.returnReport.adminEscalated', 'Escalated')
                          : t('rentals.returnReport.waitingChip', 'Waiting')
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {row.renter_reported_returned_at
                      ? formatAdminDoualaTime(row.renter_reported_returned_at, i18n.language)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {row.renter_return_escalated_at ? (
                      <Button
                        sx={{ minHeight: 48 }}
                        variant="contained"
                        onClick={() => {
                          setConfirmId(row.id);
                          setReason('');
                          setConfirmError(null);
                        }}
                      >
                        {t('rentals.returnReport.confirmReturn', 'Confirm return')}
                      </Button>
                    ) : (
                      <Button component={RouterLink} to={`/admin/rental-inspections/${row.id}`} sx={{ minHeight: 48 }}>
                        {t('rentalInspection.adminOpen', 'Open')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>{t('rentals.returnReport.adminEmpty', 'No open return reports.')}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Box>
      <Dialog open={Boolean(confirmId)} onClose={() => !busy && setConfirmId(null)} fullWidth>
        <DialogTitle>{t('rentals.returnReport.confirmReturn', 'Confirm return')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {t('rentals.returnReport.adminReported', 'Reported {{time}}', {
              time: formatAdminDoualaTime(
                returns.find((row) => row.id === confirmId)?.renter_reported_returned_at ?? '',
                i18n.language
              ),
            })}
          </Typography>
          <Typography sx={{ mb: 2 }}>
            {t(
              'rentals.returnReport.adminConfirmBody',
              'This uses the same confirm or handback path as the business. The deposit follows those rules.'
            )}
          </Typography>
          <TextField
            label={t('rentals.returnReport.adminReason', 'Reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            fullWidth
            multiline
          />
          {confirmError ? <Typography color="error" sx={{ mt: 1 }}>{confirmError}</Typography> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)} disabled={busy}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            variant="contained"
            disabled={busy || !reason.trim()}
            sx={{ minHeight: 48 }}
            onClick={() => void (async () => {
              if (!confirmId) return;
              setBusy(true);
              setConfirmError(null);
              try {
                await api.post(`/admin/rentals/bookings/${confirmId}/confirm-reported-return`, { reason: reason.trim() });
                setConfirmId(null);
                await load();
              } catch (err: unknown) {
                const data = (err as { response?: { data?: { message?: string } } }).response?.data;
                setConfirmError(data?.message || t('rentals.requestFailed', 'Request failed'));
              } finally {
                setBusy(false);
              }
            })()}
          >
            {t('common.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminInspectionDisputesPage;
