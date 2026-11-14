import { Box, Button, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { useTranslation } from 'react-i18next';
import { rentalCalendarIcs } from '../../utils/rentals/confirmationFormat';

const ACCENT = '#0A4FB5';

export function RentalStartedConfirmation({
  momo,
  due,
  zone,
  paid,
  deposit,
  title,
  startAt,
  endAt,
  location,
  onBack,
}: {
  momo: boolean;
  due: string;
  zone: string;
  paid: string;
  deposit: string;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const lead = momo
    ? t('rentalInspection.confirm.momoLead', 'Mobile Money payment succeeded. Return is due by {{due}} ({{zone}}).', { due, zone })
    : t('rentalInspection.confirm.startedLead', 'Return is due by {{due}} ({{zone}}).', { due, zone });
  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="caption" color="text.secondary">{t('rentalInspection.confirm.pageTitle', 'Confirmation')}</Typography>
      {momo ? <MomoTicks /> : <StartedMark />}
      {momo ? null : (
        <Typography variant="h5" fontWeight={800} sx={{ mt: 1.5 }}>
          {t('rentalInspection.confirm.startedTitle', 'Rental started')}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{lead}</Typography>
      <Fact label={t('rentalInspection.confirm.returnDue', 'Return due')} value={due} />
      <Fact label={t('rentalInspection.confirm.paid', 'Paid')} value={paid} />
      {deposit ? <Fact label={t('rentalInspection.confirm.deposit', 'Deposit held')} value={deposit} /> : null}
      <Button variant="contained" onClick={onBack} sx={{ mt: 3, bgcolor: ACCENT, minHeight: 48, '&:hover': { bgcolor: ACCENT } }}>
        {t('rentalInspection.confirm.backToRental', 'Back to rental')}
      </Button>
      <Button startIcon={<CalendarMonthOutlinedIcon />} onClick={() => downloadIcs(title, startAt, endAt, location)} sx={{ display: 'flex', mt: 1, color: ACCENT }}>
        {t('rentalInspection.confirm.addCalendar', 'Add to calendar')}
      </Button>
    </Box>
  );
}

function StartedMark() {
  return (
    <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'grid', placeItems: 'center', mt: 1.5 }}>
      <CheckIcon sx={{ color: ACCENT }} />
    </Box>
  );
}

function MomoTicks() {
  const { t } = useTranslation();
  return (
    <Stack spacing={1} sx={{ mt: 2 }}>
      <Tick title={t('rentalInspection.confirm.paymentConfirmed', 'Payment confirmed')} sub={t('rentalInspection.confirm.mobileMoney', 'Mobile Money')} />
      <Tick title={t('rentalInspection.confirm.startedTitle', 'Rental started')} sub="" />
    </Stack>
  );
}

function Tick({ title, sub }: { title: string; sub: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <CheckCircleIcon sx={{ color: ACCENT }} />
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        {sub ? <Typography variant="caption" color="text.secondary">{sub}</Typography> : null}
      </Box>
    </Stack>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700}>{value}</Typography>
    </Stack>
  );
}

function downloadIcs(title: string, start?: string | null, end?: string | null, location?: string | null): void {
  const blob = new Blob([rentalCalendarIcs({ title, start, end, location })], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rental.ics';
  link.click();
  URL.revokeObjectURL(url);
}
