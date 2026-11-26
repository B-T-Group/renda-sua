import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import Undo from '@mui/icons-material/Undo';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRentalApi } from '../../hooks/useRentalApi';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import {
  bookedRange,
  bookedUntil,
  fieldsToInstantIso,
  freedWindow,
  instantClock,
  listingFields,
  returnAtProblem,
  returnInstantIso,
  returningNow,
  unusedDays,
  type EarlyReturnBooking,
} from '../../utils/rentals/earlyReturn';

/** Early return on web (mock 06, 06b). Brand blue, no purple, icons first. */
const BLUE = '#0A4FB5';
const GREEN = '#0B7A3B';

export interface IconAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  testId?: string;
}

export function IconActionRow({ actions }: { actions: IconAction[] }) {
  return (
    <Stack direction="row" justifyContent="space-around" sx={{ pt: 1.5, mt: 1, borderTop: 1, borderColor: 'divider' }}>
      {actions.map((action) => (
        <Stack
          key={action.key}
          component="button"
          type="button"
          data-testid={action.testId}
          aria-label={action.label}
          onClick={action.onClick}
          alignItems="center"
          spacing={0.75}
          sx={{ flex: 1, border: 0, bgcolor: 'transparent', cursor: 'pointer', p: 0.5, font: 'inherit' }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: action.primary ? '#fff' : 'text.primary',
              bgcolor: action.primary ? BLUE : '#F1EFEA',
            }}
          >
            {action.icon}
          </Box>
          <Typography variant="caption" fontWeight={600} sx={{ color: action.primary ? BLUE : 'text.secondary' }}>
            {action.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export interface SummaryLine {
  key: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  chips?: string[];
  onEdit?: () => void;
  editLabel?: string;
}

export function SummaryTable({ lines, testId }: { lines: SummaryLine[]; testId?: string }) {
  return (
    <Box data-testid={testId} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, mt: 2 }}>
      {lines.map((line, index) => (
        <Stack
          key={line.key}
          direction="row"
          alignItems="center"
          spacing={1.25}
          sx={{ px: 1.5, py: 1.1, borderTop: index ? 1 : 0, borderColor: 'divider', minHeight: 44 }}
        >
          <Box sx={{ color: 'text.secondary', display: 'flex', '& svg': { fontSize: 18 } }}>{line.icon}</Box>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {line.label}
          </Typography>
          {line.chips?.length ? (
            <Stack direction="row" spacing={0.75}>
              {line.chips.map((chip) => (
                <Typography
                  key={chip}
                  variant="caption"
                  sx={{ px: 1, py: 0.25, borderRadius: 99, bgcolor: '#EEECE7', color: 'text.secondary', textDecoration: 'line-through' }}
                >
                  {chip}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight={700}>
                {line.value}
              </Typography>
              {line.sub ? (
                <Typography variant="caption" color="text.secondary" component="div">
                  {line.sub}
                </Typography>
              ) : null}
            </Box>
          )}
          {line.onEdit ? (
            <IconButton size="small" aria-label={line.editLabel} onClick={line.onEdit} sx={{ color: BLUE }} data-testid="early-return-edit-time">
              <EditOutlined fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
      ))}
    </Box>
  );
}

function SheetDialog(props: {
  open: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xs" data-testid={props.testId}>
      <DialogContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#EAF1FB', color: BLUE, display: 'grid', placeItems: 'center' }}>
            {props.icon}
          </Box>
          <IconButton aria-label="close" onClick={props.onClose} size="small" sx={{ bgcolor: '#F1EFEA' }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="h6" fontWeight={800} sx={{ mt: 1.5 }}>
          {props.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {props.body}
        </Typography>
        {props.children}
      </DialogContent>
    </Dialog>
  );
}

export interface RenterEarlyReturnProps {
  booking: EarlyReturnBooking & { id: string };
  timeZone: string;
  price: string;
  deposit: string;
  location: string;
  address: string | null;
  onReported: () => void;
  initialOpen?: boolean;
  now?: number;
}

/** AC1–3 web: "Return by" card with Directions · Message · ↶ Return early, and the dialog (06). */
export function RenterEarlyReturnPanel(props: RenterEarlyReturnProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  const lang = i18n.language;
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, borderColor: '#C5D7F2' }} data-testid="renter-early-return">
      <Typography variant="h6" fontWeight={800}>
        {t('rentals.earlyReturn.returnBy', 'Return by {{time}}', { time: bookedUntil(props.booking, lang, props.timeZone) })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('rentals.earlyReturn.booked', 'Booked')} {bookedRange(props.booking, lang, props.timeZone)}
      </Typography>
      <IconActionRow
        actions={[
          {
            key: 'directions',
            icon: <LocationOnOutlined />,
            label: t('rentals.earlyReturn.directions', 'Directions'),
            onClick: () => openMaps(props.address || props.location),
          },
          {
            key: 'message',
            icon: <ChatBubbleOutline />,
            label: t('rentals.earlyReturn.message', 'Message'),
            onClick: () => document.getElementById('rental-messages')?.scrollIntoView({ behavior: 'smooth' }),
          },
          {
            key: 'early',
            icon: <Undo />,
            label: t('rentals.earlyReturn.action', 'Return early'),
            onClick: () => setOpen(true),
            primary: true,
            testId: 'renter-early-return-action',
          },
        ]}
      />
      <RenterEarlyReturnDialog {...props} open={open} onClose={() => setOpen(false)} />
    </Paper>
  );
}

export function RenterEarlyReturnDialog(props: RenterEarlyReturnProps & { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { reportReturned } = useRentalApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = i18n.language;
  const now = props.now ?? Date.now();
  const unused = unusedDays(props.booking, now, lang, props.timeZone);
  const lines: SummaryLine[] = [
    { key: 'booked', icon: <CalendarTodayOutlined />, label: t('rentals.earlyReturn.booked', 'Booked'), value: bookedRange(props.booking, lang, props.timeZone) },
    ...(unused.length
      ? [{ key: 'unused', icon: <InfoOutlined />, label: t('rentals.earlyReturn.unusedDays', 'Unused days · no refund'), chips: unused }]
      : []),
    { key: 'now', icon: <Undo />, label: t('rentals.earlyReturn.returningNow', 'Returning now'), value: returningNow(props.booking, now, lang, props.timeZone) },
    {
      key: 'pay',
      icon: props.deposit ? <CreditCardOutlined /> : <AccountBalanceWalletOutlined />,
      label: t('rentals.earlyReturn.youPay', 'You pay'),
      value: props.price,
      sub: t('rentals.earlyReturn.fullPrice', 'full price'),
    },
    ...(props.deposit
      ? [{
          key: 'deposit',
          icon: <ShieldOutlined />,
          label: t('rentals.earlyReturn.deposit', 'Deposit'),
          value: props.deposit,
          sub: t('rentals.earlyReturn.depositAfter', 'released after the business confirms'),
        }]
      : []),
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await reportReturned(props.booking.id);
      if (!result.alreadyReported) {
        trackSiteEvent({
          eventType: 'rental_renter_reported_returned',
          subjectType: 'rental_booking',
          subjectId: props.booking.id,
          metadata: {
            booking_id: props.booking.id,
            reported_at: result.report.reportedAt,
            was_overdue: result.wasOverdue,
            early: true,
          },
        });
      }
      props.onClose();
      props.onReported();
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'RENTAL_RETURN_ALREADY_CONFIRMED') {
        props.onClose();
        props.onReported();
        return;
      }
      setError(
        code === 'RENTAL_RETURN_NOT_RECEIVED_OPEN'
          ? t('rentals.earlyReturn.notReceivedOpen', 'You reported that you didn’t receive the item. Support will follow up.')
          : t('rentals.earlyReturn.failed', 'Could not send. Check your connection and try again.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetDialog
      open={props.open}
      icon={<Undo />}
      testId="renter-early-return-dialog"
      title={t('rentals.earlyReturn.sheetTitle', 'Return early?')}
      body={
        props.deposit
          ? t('rentals.earlyReturn.sheetBody', 'You’ll still pay the full {{price}} for this booking. Your deposit is released once the business confirms the return.', { price: props.price })
          : t('rentals.earlyReturn.sheetBodyNoDeposit', 'You’ll still pay the full {{price}} for this booking. The business confirms the return when they get the item.', { price: props.price })
      }
      onClose={() => !busy && props.onClose()}
    >
      <SummaryTable lines={lines} testId="renter-early-return-summary" />
      <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.5, color: 'text.secondary' }}>
        <LocationOnOutlined sx={{ fontSize: 16, mt: 0.25 }} />
        <Typography variant="caption">
          {t('rentals.earlyReturn.where', 'Hand the item to the staff at {{location}}.', {
            location: props.address ? `${props.location} · ${props.address}` : props.location,
          })}
        </Typography>
      </Stack>
      {error ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {error}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="outlined" fullWidth disabled={busy} onClick={props.onClose} sx={{ minHeight: 44, color: 'text.primary', borderColor: 'divider' }}>
          {t('rentals.earlyReturn.keep', 'Keep renting')}
        </Button>
        <Button
          variant="contained"
          fullWidth
          disabled={busy}
          startIcon={<Undo />}
          onClick={() => void submit()}
          sx={{ minHeight: 44, bgcolor: BLUE }}
          data-testid="renter-early-return-confirm"
        >
          {t('rentals.earlyReturn.action', 'Return early')}
        </Button>
      </Stack>
    </SheetDialog>
  );
}

/** AC10 web: completed early return (05 / 05b). */
export function RenterReturnedEarlyCard(props: {
  booking: EarlyReturnBooking;
  timeZone: string;
  price: string;
  deposit: string;
  hold: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <Stack spacing={2} sx={{ mb: 2 }} data-testid="renter-returned-early">
      <EdgeCard tone="green" icon={<Check />} title={t('rentals.earlyReturn.returnedEarly', 'Returned early · {{time}}', { time: instantClock(returnInstantIso(props.booking), lang, props.timeZone) })}>
        <Typography variant="body2">
          {t('rentals.earlyReturn.bookedUntil', 'Booked until {{time}}', { time: bookedUntil(props.booking, lang, props.timeZone) })}
        </Typography>
      </EdgeCard>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        {props.deposit ? (
          <>
            <MoneyRow label={t('rentals.earlyReturn.rentalCharged', 'Rental charged')} value={props.price} />
            <MoneyRow label={t('rentals.earlyReturn.depositReleased', 'Deposit released')} value={props.deposit} positive />
            {props.hold ? (
              <Typography variant="caption" color="text.secondary">
                {t('rentals.earlyReturn.holdClosed', 'The {{amount}} card hold is closed.', { amount: props.hold })}
              </Typography>
            ) : null}
          </>
        ) : (
          <>
            <MoneyRow label={t('rentals.earlyReturn.paidMomo', 'Paid by Mobile Money')} value={props.price} />
            <Typography variant="caption" color="text.secondary">
              {t('rentals.earlyReturn.momoNoRefund', 'Full price, no refund for unused time')}
            </Typography>
          </>
        )}
      </Paper>
    </Stack>
  );
}

function MoneyRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color: positive ? GREEN : 'text.primary' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function EdgeCard(props: { tone: 'blue' | 'green'; icon: React.ReactNode; title: string; children?: React.ReactNode; testId?: string }) {
  return (
    <Paper
      variant="outlined"
      data-testid={props.testId}
      sx={{ p: 2, borderRadius: 2, borderLeft: 4, borderLeftColor: props.tone === 'green' ? GREEN : BLUE }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: BLUE }}>
        {props.icon}
        <Typography variant="subtitle1" fontWeight={800} color="text.primary">
          {props.title}
        </Typography>
      </Stack>
      <Box sx={{ mt: 0.5 }}>{props.children}</Box>
    </Paper>
  );
}

/** AC4 web (06b): Returned early · 3:40 PM, ✓ Confirm return, ⚠ problem, 💬 message, freed window. */
export function BusinessEarlyReturnCard(props: {
  booking: EarlyReturnBooking;
  timeZone: string;
  deposit: string;
  onConfirm: () => void;
  onProblem: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reported = props.booking.renter_reported_returned_at;
  const end = bookedUntil(props.booking, lang, props.timeZone);
  return (
    <Box sx={{ mb: 2 }} data-testid="business-return-report-early">
      <EdgeCard tone="blue" icon={<Undo />} title={t('rentals.earlyReturn.returnedEarly', 'Returned early · {{time}}', { time: instantClock(reported, lang, props.timeZone) })}>
        <Typography variant="body2">
          {props.deposit
            ? t('rentals.earlyReturn.businessBody', 'Booked until {{end}}. Check the item, then confirm the return. The {{amount}} deposit is released only after you confirm.', { end, amount: props.deposit })
            : t('rentals.earlyReturn.businessBodyNoDeposit', 'Booked until {{end}}. Check the item, then confirm the return.', { end })}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button variant="contained" startIcon={<Check />} onClick={props.onConfirm} sx={{ flex: 1, minHeight: 44, bgcolor: BLUE }} data-testid="business-early-confirm">
            {t('rentals.earlyReturn.confirm', 'Confirm return')}
          </Button>
          <IconButton aria-label={t('rentals.earlyReturn.problem', 'Report a problem')} onClick={props.onProblem} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 44 }}>
            <WarningAmberOutlined />
          </IconButton>
          <IconButton
            aria-label={t('rentals.earlyReturn.message', 'Message')}
            onClick={() => document.getElementById('rental-messages')?.scrollIntoView({ behavior: 'smooth' })}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 44 }}
          >
            <ChatBubbleOutline />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, p: 1, borderRadius: 1.5, bgcolor: '#EAF1FB' }}>
          <LockOpenOutlined sx={{ fontSize: 18, color: BLUE }} />
          <Typography variant="caption" color="text.secondary">
            {t('rentals.earlyReturn.frees', '{{from}} – {{to}} opens for new bookings once you confirm.', {
              from: instantClock(reported, lang, props.timeZone),
              to: end,
            })}
          </Typography>
        </Stack>
      </EdgeCard>
    </Box>
  );
}

/** ↶ Item returned for the business on an active rental (04c), next to Call / Message. */
export function BusinessItemReturnedActions(props: { phone?: string | null; onItemReturned: () => void }) {
  const { t } = useTranslation();
  return (
    <IconActionRow
      actions={[
        ...(props.phone
          ? [{ key: 'call', icon: <PhoneOutlined />, label: t('rentals.earlyReturn.call', 'Call'), onClick: () => { window.location.href = `tel:${props.phone}`; } }]
          : []),
        {
          key: 'message',
          icon: <ChatBubbleOutline />,
          label: t('rentals.earlyReturn.message', 'Message'),
          onClick: () => document.getElementById('rental-messages')?.scrollIntoView({ behavior: 'smooth' }),
        },
        {
          key: 'returned',
          icon: <Undo />,
          label: t('rentals.earlyReturn.itemReturned', 'Item returned'),
          onClick: props.onItemReturned,
          primary: true,
          testId: 'business-item-returned',
        },
      ]}
    />
  );
}

/** AC5/AC6 web: Confirm return? with "Returned at" on the listing clock (✎ to correct). */
export function BusinessReturnConfirmDialog(props: {
  open: boolean;
  booking: EarlyReturnBooking;
  timeZone: string;
  zoneLabel: string;
  price: string;
  deposit: string;
  busy?: boolean;
  initialEditing?: boolean;
  now?: number;
  onClose: () => void;
  onConfirm: (actualEndAt: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reported = props.booking.renter_reported_returned_at || null;
  const [openedAt, setOpenedAt] = useState(() => props.now ?? Date.now());
  const defaultIso = reported || new Date(openedAt).toISOString();
  const [editing, setEditing] = useState(Boolean(props.initialEditing));
  const [date, setDate] = useState(listingFields(Date.parse(defaultIso), props.timeZone).date);
  const [time, setTime] = useState(listingFields(Date.parse(defaultIso), props.timeZone).time);

  useEffect(() => {
    if (!props.open) return;
    const at = props.now ?? Date.now();
    setOpenedAt(at);
    const fields = listingFields(Date.parse(reported || new Date(at).toISOString()), props.timeZone);
    setDate(fields.date);
    setTime(fields.time);
    setEditing(Boolean(props.initialEditing));
  }, [props.open, props.now, props.timeZone, props.initialEditing, reported]);

  const chosenIso = editing ? fieldsToInstantIso(date, time, props.timeZone) : defaultIso;
  const problem = returnAtProblem(chosenIso, props.booking, props.now ?? Date.now());
  const edited = editing && chosenIso !== defaultIso;
  const window = chosenIso ? freedWindow(props.booking, chosenIso, lang, props.timeZone) : '';
  const lines: SummaryLine[] = [
    {
      key: 'at',
      icon: <Undo />,
      label: t('rentals.earlyReturn.returnedAt', 'Returned at'),
      value: instantClock(chosenIso, lang, props.timeZone),
      sub: edited ? undefined : reported ? t('rentals.earlyReturn.rentersReport', 'renter’s report') : t('rentals.earlyReturn.now', 'now'),
      onEdit: () => setEditing(true),
      editLabel: t('rentals.earlyReturn.editTime', 'Change the return time'),
    },
    {
      key: 'pays',
      icon: props.deposit ? <CreditCardOutlined /> : <AccountBalanceWalletOutlined />,
      label: t('rentals.earlyReturn.renterPays', 'Renter pays'),
      value: props.price,
      sub: t('rentals.earlyReturn.fullPrice', 'full price'),
    },
    ...(props.deposit
      ? [{ key: 'deposit', icon: <ShieldOutlined />, label: t('rentals.earlyReturn.deposit', 'Deposit'), value: props.deposit, sub: t('rentals.earlyReturn.depositReleasedTo', 'released to the renter') }]
      : []),
    ...(window ? [{ key: 'opens', icon: <LockOpenOutlined />, label: t('rentals.earlyReturn.opens', 'Opens for booking'), value: window }] : []),
  ];
  const problemText =
    problem === 'beforePickup'
      ? t('rentals.earlyReturn.errBeforePickup', 'The return can’t be before pickup.')
      : problem === 'future'
        ? t('rentals.earlyReturn.errFuture', 'The return can’t be in the future.')
        : problem === 'invalid'
          ? t('rentals.earlyReturn.errInvalid', 'Enter a valid date and time.')
          : '';
  return (
    <SheetDialog
      open={props.open}
      icon={<Check />}
      testId="business-return-confirm-dialog"
      title={t('rentals.earlyReturn.confirmTitle', 'Confirm return?')}
      body={t('rentals.earlyReturn.confirmBody', 'You checked the item and have it back. The rental ends now and you’re paid the full price.')}
      onClose={() => !props.busy && props.onClose()}
    >
      <SummaryTable lines={lines} testId="business-return-confirm-summary" />
      {editing ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} data-testid="business-return-time-fields">
          <TextField size="small" type="date" label={t('rentals.earlyReturn.date', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
          <TextField
            size="small"
            type="time"
            label={t('rentals.earlyReturn.time', 'Time ({{zone}})', { zone: props.zoneLabel })}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
        </Stack>
      ) : null}
      {problemText ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {problemText}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="outlined" fullWidth disabled={props.busy} onClick={props.onClose} sx={{ minHeight: 44, color: 'text.primary', borderColor: 'divider' }}>
          {t('rentals.earlyReturn.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Check />}
          disabled={props.busy || !!problem || !chosenIso}
          onClick={() => chosenIso && props.onConfirm(chosenIso)}
          sx={{ minHeight: 44, bgcolor: BLUE }}
          data-testid="business-return-confirm"
        >
          {t('rentals.earlyReturn.confirm', 'Confirm return')}
        </Button>
      </Stack>
    </SheetDialog>
  );
}

function openMaps(destination: string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank', 'noopener');
}
