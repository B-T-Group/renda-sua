import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { useRentalApi } from '../../hooks/useRentalApi';
import type { RenterReturnPhase } from '../../utils/renterReturnPhase';
import { formatDoualaStamp } from '../../utils/renterReturnPhase';

export function RenterReturnPanel({
  phase,
  bookingId,
  location,
  address,
  phone,
  endAt,
  reportedAt,
  depositLabel,
  onChanged,
}: {
  phase: Exclude<RenterReturnPhase, 'hidden'>;
  bookingId: string;
  location: string;
  address: string | null;
  phone: string | null;
  endAt: string;
  reportedAt?: string | null;
  depositLabel: string;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { reportReturned } = useRentalApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const overdue = phase === 'overdue';
  const due = formatDoualaStamp(endAt, i18n.language);
  const when = formatDoualaStamp(reportedAt || endAt, i18n.language);

  const submit = async () => {
    setBusy(true);
    setRetry(false);
    try {
      const result = await reportReturned(bookingId);
      setOpen(false);
      if (!result.alreadyReported) {
        trackSiteEvent({
          eventType: 'rental_renter_reported_returned',
          subjectType: 'rental_booking',
          subjectId: bookingId,
          metadata: {
            booking_id: bookingId,
            reported_at: result.report.reportedAt,
            was_overdue: result.wasOverdue,
          },
        });
      }
      onChanged();
    } catch (error: unknown) {
      const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'RENTAL_RETURN_ALREADY_CONFIRMED') {
        setOpen(false);
        onChanged();
        return;
      }
      setRetry(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      data-testid={`renter-return-${phase}`}
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: overdue ? 'error.light' : '#C5D7F2',
        bgcolor: overdue ? '#FDECEC' : '#F3F7FB',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          sx={{ px: 1, py: 0.25, borderRadius: 99, border: 1, borderColor: overdue ? 'error.main' : '#0A4FB5', color: overdue ? 'error.main' : '#0A4FB5' }}
        >
          {t(overdue ? 'rentals.returnReport.overdue' : 'rentals.bookingStatus.awaiting_return', overdue ? 'Overdue' : 'Return due')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('rentals.returnReport.nextStep', 'Next step')}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" fontWeight={700} color={overdue ? 'error.main' : 'text.primary'}>
        {heading(phase, t, location, due)}
      </Typography>
      {copy(phase, t, location, when, depositLabel) ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {copy(phase, t, location, when, depositLabel)}
        </Typography>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" startIcon={<LocationOnOutlined />} sx={{ minHeight: 48, flex: 1 }} onClick={() => openMaps(address || location)}>
          {t('rentals.returnReport.directions', 'Directions')}
        </Button>
        <Button variant="outlined" startIcon={<ChatBubbleOutline />} sx={{ minHeight: 48, flex: 1 }} onClick={() => setContact(true)}>
          {t('rentals.returnReport.contact', 'Contact business')}
        </Button>
      </Stack>
      {phase === 'due' || phase === 'overdue' ? (
        <Button variant="contained" fullWidth sx={{ mt: 1.5, minHeight: 48, bgcolor: '#0A4FB5' }} onClick={() => { setRetry(false); setOpen(true); }}>
          {t('rentals.returnReport.primary', 'I’ve returned it')}
        </Button>
      ) : null}
      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth>
        <DialogTitle>{t('rentals.returnReport.sheetTitle', 'Did you hand the item to the business?')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              'rentals.returnReport.sheetBody',
              'The business will check the item and confirm. Your {{amount}} deposit is released only after they confirm. This does not end the rental by itself.',
              { amount: depositLabel }
            )}
          </Typography>
          {retry ? (
            <Typography color="error" sx={{ mt: 1 }}>
              {t('rentals.returnReport.networkBody', 'Check your connection and try again.')}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" disabled={busy} onClick={() => void submit()} sx={{ minHeight: 48, bgcolor: '#0A4FB5' }}>
            {retry ? t('rentals.returnReport.retry', 'Try again') : t('common.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={contact} onClose={() => setContact(false)}>
        <DialogTitle>{t('rentals.returnReport.contact', 'Contact business')}</DialogTitle>
        <DialogActions>
          {phone ? (
            <Button href={`tel:${phone}`} sx={{ minHeight: 48 }}>{t('rentals.returnReport.call', 'Call')}</Button>
          ) : null}
          <Button href="#rental-messages" onClick={() => setContact(false)} sx={{ minHeight: 48 }}>
            {t('rentals.returnReport.message', 'Message')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function heading(
  phase: RenterReturnPhase,
  t: (key: string, def: string, opts?: Record<string, string>) => string,
  location: string,
  due: string
): string {
  if (phase === 'waiting') return t('rentals.returnReport.waitingTitle', 'Waiting for the business to confirm');
  if (phase === 'escalated') return t('rentals.returnReport.escalatedTitle', 'Support is checking your return');
  if (phase === 'overdue') return t('rentals.returnReport.overdueTitle', 'Overdue since {{time}}', { time: due });
  return t('rentals.returnReport.dueTitle', 'Bring the item to {{location}} by {{time}}', { location, time: due });
}

function copy(
  phase: RenterReturnPhase,
  t: (key: string, def: string, opts?: Record<string, string>) => string,
  location: string,
  when: string,
  amount: string
): string {
  if (phase === 'waiting') {
    return t(
      'rentals.returnReport.waitingBody',
      'You reported the return on {{time}}. The business will check the item. Your {{amount}} deposit is released only after they confirm.',
      { time: when, amount }
    );
  }
  if (phase === 'escalated') {
    return t(
      'rentals.returnReport.escalatedBody',
      'You reported the return on {{time}}. The business has not confirmed within 24 hours. Support is following up. Your {{amount}} deposit is still held.',
      { time: when, amount }
    );
  }
  if (phase === 'overdue') {
    return t('rentals.returnReport.overdueBody', 'Bring the item to {{location}} as soon as you can.', { location });
  }
  return '';
}

function openMaps(destination: string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank', 'noopener');
}
