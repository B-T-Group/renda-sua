import { Lock, PlayArrow, Storefront } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatZonedDay, formatZonedTime, formatZonedWeekday, pickupPhase } from '../../utils/rentalStartWindow';

export interface StartPanelBooking {
  status: string;
  start_at: string;
  end_at: string;
  start_opens_at?: string | null;
  actual_start_at?: string | null;
  currency: string;
  payment_status?: string | null;
}

interface Props {
  booking: StartPanelBooking;
  timeZone: string;
  role: 'client' | 'business';
  renterName?: string;
  place: string;
  money: string;
  returnLabel: string;
  starting?: boolean;
  onConfirm: () => void;
  onNotCollected?: () => void;
  missing?: React.ReactNode;
}

export function RentalStartPanel(props: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const started = props.booking.status === 'active' || Boolean(props.booking.actual_start_at);
  const phase = pickupPhase({
    now: Date.now(),
    startAt: props.booking.start_at,
    endAt: props.booking.end_at,
    startOpensAt: props.booking.start_opens_at,
    timeZone: props.timeZone,
    started,
  });
  const day = formatZonedDay(props.booking.start_at, props.timeZone, i18n.language);
  const when = `${formatZonedWeekday(props.booking.start_at, props.timeZone, i18n.language)} ${day}`;
  const time = formatZonedTime(props.booking.start_at, props.timeZone);
  const locked = phase === 'before' || phase === 'closed';
  const momo = (props.booking.currency === 'XAF' || props.booking.currency === 'XOF') && props.booking.payment_status !== 'paid';
  const pill = phase === 'before'
    ? t('rentals.start.pillDay', 'Pickup {{day}}', { day })
    : phase === 'late'
      ? t('rentals.start.latePickup', 'Late pickup')
      : phase === 'started'
        ? t('rentals.journey.inProgress', 'In progress')
        : t('rentals.start.pickupToday', 'Pickup today');
  const title = titleText(phase, props.role, props.renterName, when, time, props.booking.actual_start_at, props.timeZone, t);
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.success.main, 0.12), border: 1, borderColor: 'success.main', color: 'text.primary' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" sx={{ bgcolor: 'success.main', color: 'common.white', px: 1, py: 0.25, borderRadius: 999 }}>{pill}</Typography>
        <Typography variant="caption">{t('rentals.nextStep.label', 'NEXT STEP')}</Typography>
      </Stack>
      <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{bodyText(phase, props.role, momo, t)}</Typography>
      {phase !== 'started' && props.role === 'client' ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {momo
            ? t('rentals.start.momoLine', 'Mobile Money · {{amount}}', { amount: props.money })
            : t('rentals.start.held', '{{amount}} held on your card', { amount: props.money })}
        </Typography>
      ) : null}
      <Typography variant="body2">{t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })}</Typography>
      {props.role === 'client' && phase !== 'started' ? (
        <Button
          variant="contained"
          disabled={locked || props.starting}
          startIcon={locked ? <Lock /> : <PlayArrow />}
          onClick={() => setOpen(true)}
          sx={{ mt: 1.5 }}
        >
          {locked
            ? t('rentals.start.locked', 'Start rental · from {{day}}', { day })
            : t('rentals.start.button', 'Start rental{{amount}}', { amount: momo ? ` · ${props.money}` : '' })}
        </Button>
      ) : null}
      {props.role === 'business' && phase === 'started' && props.onNotCollected ? (
        <Button color="error" onClick={props.onNotCollected} sx={{ mt: 1 }}>
          {t('rentals.business.notCollected', 'Item not collected?')}
        </Button>
      ) : null}
      {props.role === 'client' && phase === 'started' ? props.missing : null}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogContent>
          <Stack alignItems="center" spacing={1}>
            <Storefront color="primary" />
            <Typography variant="h6">{t('rentals.start.confirmTitle', 'Start rental?')}</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t('rentals.start.confirmBody', 'Only start once you are with the business. The business will hand over the item once you start.')}
            </Typography>
          </Stack>
          <Typography sx={{ mt: 2 }}>{props.place}</Typography>
          <Typography>{t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })}</Typography>
          <Typography>{props.money}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t('rentals.start.didntHint', "Didn't get the item after starting? You can tell us within 30 minutes.")}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', px: 3, pb: 2 }}>
          <Button fullWidth variant="contained" startIcon={<PlayArrow />} disabled={props.starting} onClick={() => { setOpen(false); props.onConfirm(); }}>
            {t('rentals.actions.startRental', 'Start rental')}
          </Button>
          <Button fullWidth onClick={() => setOpen(false)}>{t('rentals.start.notYet', 'Not yet')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function titleText(
  phase: string,
  role: string,
  name: string | undefined,
  when: string,
  time: string,
  startedAt: string | null | undefined,
  zone: string,
  t: (key: string, fallback: string, vars?: Record<string, string>) => string
): string {
  if (role === 'business' && phase !== 'started') {
    return t('rentals.business.waitingTitle', 'Waiting for {{name}} to start', { name: name || 'the renter' });
  }
  if (phase === 'started') {
    const at = startedAt ? formatZonedTime(startedAt, zone) : time;
    return role === 'business'
      ? t('rentals.business.startedLine', 'Started at {{time}} · hand over the item', { time: at })
      : t('rentals.start.startedBanner', 'Rental started at {{time}}. The business has been notified to hand over the item.', { time: at });
  }
  if (phase === 'before') return t('rentals.start.pickupOn', 'Pickup on {{when}} · {{time}}', { when, time });
  return t('rentals.start.todayTitle', 'Pick up your item · {{time}}', { time });
}

function bodyText(phase: string, role: string, momo: boolean, t: (key: string, fallback: string) => string): string {
  if (role === 'business' && phase !== 'started') {
    return t('rentals.business.waitingBody', 'Hand over the item only after you get “Rental started”. No PIN needed.');
  }
  if (phase === 'before') return t('rentals.start.beforeBody', 'You can start the rental on the pickup day, once you are at the business.');
  if (momo) return t('rentals.start.momoBody', 'At the business, tap Start rental. You pay then, and they hand over the item once the payment goes through.');
  return t('rentals.start.todayBody', 'At the business, tap Start rental. They hand over the item once you start.');
}
