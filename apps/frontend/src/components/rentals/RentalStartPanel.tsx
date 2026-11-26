import { AccountBalanceWallet, CalendarMonth, CreditCard, HelpOutline, Lock, LockOutlined, PhoneIphone, PlayArrow, Storefront } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatConfirmationMoney } from '../../utils/rentals/confirmationFormat';
import { startMoney, startMoneyLines, type StartMoneyBooking } from '../../utils/rentals/startMoney';
import { BOOKING_CLOCK, formatZonedTime, formatZonedWeekdayDay, formatZonedWhen, pickupPhase } from '../../utils/rentalStartWindow';
import { earlyReturnLine, earlyReturnPreview } from '../../utils/rentals/returnDue';
import { waitingForRenterTitle } from '../../utils/rentals/frenchElision';
import { payBreakdown } from '../../utils/rentals/payBreakdown';
import { PayBreakdownBox, PayFooter } from './PayBreakdownBox';
import { clockRange } from '../../utils/rentals/reserveSummary';

export interface StartPanelBooking {
  status: string;
  start_at: string;
  end_at: string;
  start_opens_at?: string | null;
  actual_start_at?: string | null;
  currency: string;
  payment_status?: string | null;
  payment_timing?: string | null;
  card_pay_at_pickup?: boolean | null;
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
  total_amount?: number | string | null;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  accept_start_preview?: StartMoneyBooking['accept_start_preview'];
  return_due_at?: string | null;
  rental_pricing_snapshot?: unknown;
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
  const when = formatZonedWeekdayDay(props.booking.start_at, BOOKING_CLOCK, i18n.language);
  const time = formatZonedTime(props.booking.start_at, BOOKING_CLOCK, i18n.language, props.timeZone);
  const locked = phase === 'before' || phase === 'closed';
  const hold = startMoney(props.booking);
  const momo = hold.kind === 'momo_due';
  const card = hold.kind === 'card_due';
  const payAtPickup = props.booking.payment_timing === 'pay_at_pickup';
  const lines = startMoneyLines(hold, (value) => formatConfirmationMoney(value, props.booking.currency, i18n.language), t);
  const late = phase === 'late';
  const tone = late ? 'warning.main' : 'success.main';
  const pays = card || momo;
  const breakdown = pays ? payBreakdown(props.booking, i18n.language, t) : null;
  const pill = phase === 'before'
    ? t('rentals.start.pillDay', 'Pickup {{day}}', { day: when })
    : phase === 'late'
      ? t('rentals.start.latePickup', 'Late pickup')
      : phase === 'started'
        ? t('rentals.journey.inProgress', 'In progress')
        : t('rentals.start.pickupToday', 'Pickup today');
  // Hourly early start: the due time if the renter starts now (renter Start dialog only).
  const early = phase !== 'started' ? earlyReturnPreview(props.booking, Date.now(), props.timeZone) : null;
  const returnLine = early
    ? earlyReturnLine(early, i18n.language, t)
    : t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel });
  const body = bodyText(phase, props.role, momo, t, card, payAtPickup);
  const title = titleText(phase, props.role, props.renterName, when, time, props.booking.actual_start_at, props.timeZone, t, i18n.language, payAtPickup);
  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: (theme) => alpha(late ? theme.palette.warning.main : theme.palette.success.main, 0.12), border: 1, borderColor: tone, color: 'text.primary' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" sx={{ bgcolor: tone, color: 'common.white', px: 1, py: 0.25, borderRadius: 999 }}>{pill}</Typography>
        <Typography variant="caption">{t('rentals.nextStep.label', 'NEXT STEP')}</Typography>
      </Stack>
      <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
      {body ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{body}</Typography> : null}
      {late ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t('rentals.start.lateStill', 'Booked for {{time}} · you can still start until {{until}}', {
            time,
            until: formatZonedWhen(props.booking.end_at, BOOKING_CLOCK, i18n.language, props.timeZone),
          })}
        </Typography>
      ) : null}
      {phase !== 'started' && props.role === 'client' ? (
        <Box sx={{ mt: 1 }} data-testid="rental-start-money">
          <Typography variant="body2">{lines.main}</Typography>
          {lines.sub ? <Typography variant="caption" color="text.secondary" display="block">{lines.sub}</Typography> : null}
        </Box>
      ) : null}
      <Typography variant="body2">
        {props.role === 'business' && phase !== 'started'
          ? t('rentals.start.bookedDay', 'Booked {{day}} · {{range}}', {
              day: formatZonedWeekdayDay(props.booking.start_at, BOOKING_CLOCK, i18n.language),
              range: clockRange(props.booking.start_at, props.booking.end_at, i18n.language, props.timeZone),
            })
          : props.role === 'business'
            ? t('rentals.start.returnDueBusiness', 'Return by {{when}}', { when: props.returnLabel })
            : t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })}
      </Typography>
      {props.role === 'client' && phase !== 'started' ? (
        <Button
          variant="contained"
          disabled={locked || props.starting}
          startIcon={locked ? <Lock /> : card ? <CreditCard /> : momo ? <PhoneIphone /> : <PlayArrow />}
          onClick={() => setOpen(true)}
          sx={{ mt: 1.5 }}
          data-testid="rental-start-button"
        >
          {locked
            ? t('rentals.start.pickupOpens', 'Pickup opens {{day}}', { day: when })
            : pays
              ? t('rentals.payAtPickup.payAndStart', 'Pay & start · {{amount}}', { amount: props.money })
              : t('rentals.start.button', 'Start rental{{amount}}', { amount: '' })}
        </Button>
      ) : null}
      {props.role === 'business' && phase === 'started' && props.onNotCollected ? (
        <Button color="error" startIcon={<HelpOutline />} onClick={props.onNotCollected} sx={{ mt: 1 }}>
          {t('rentals.business.notCollected', 'Item not collected?')}
        </Button>
      ) : null}
      {props.role === 'client' && phase === 'started' ? props.missing : null}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogContent>
          <Stack alignItems="center" spacing={1}>
            <Box data-testid="rental-start-sheet-hero" sx={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }}>
              {card ? <CreditCard color="primary" /> : momo ? <PhoneIphone color="primary" /> : <Storefront color="primary" />}
            </Box>
            <Typography variant="h6">{pays ? t('rentals.payAtPickup.payTitle', 'Pay and start') : t('rentals.start.confirmTitle', 'Start rental?')}</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {card
                ? t('rentals.payAtPickup.payBodyWeb', 'Pay now on a secure Stripe page and the business hands you the item. The rental starts when the payment goes through.')
                : momo
                ? t('rentals.payAtPickup.payBody', 'Pay now and the business hands you the item. The rental starts when the payment goes through.')
                : t('rentals.start.confirmBody', 'Only start once you are with the business. The business will hand over the item once you start.')}
            </Typography>
          </Stack>
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1}><Storefront fontSize="small" color="action" /><Typography>{props.place}</Typography></Stack>
            <Stack direction="row" spacing={1}><CalendarMonth fontSize="small" color="action" /><Typography>{returnLine}</Typography></Stack>
            {breakdown ? null : (
              <Stack direction="row" spacing={1} data-testid="rental-start-sheet-money">
                <MoneyIcon icon={lines.icon} />
                <Box>
                  <Typography>{lines.main}</Typography>
                  {lines.sub ? <Typography variant="caption" color="text.secondary" display="block">{lines.sub}</Typography> : null}
                </Box>
              </Stack>
            )}
          </Stack>
          {breakdown ? <PayBreakdownBox breakdown={breakdown} /> : null}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t('rentals.start.didntHint', "Didn't get the item after starting? You can tell us within 30\u00a0minutes.")}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', px: 3, pb: 2 }}>
          <Button fullWidth variant="contained" sx={{ whiteSpace: 'nowrap' }} startIcon={card ? <LockOutlined /> : momo ? <PhoneIphone /> : <PlayArrow />} disabled={props.starting} onClick={() => { setOpen(false); props.onConfirm(); }}>
            {pays && momo
              ? t('rentals.payAtPickup.payButtonMomo', 'Pay {{amount}} & start', { amount: props.money })
              : pays
              ? t('rentals.payAtPickup.payButton', 'Pay {{amount}} · start rental', { amount: props.money })
              : t('rentals.actions.startRental', 'Start rental')}
          </Button>
          {breakdown ? <PayFooter breakdown={breakdown} /> : null}
          <Button fullWidth onClick={() => setOpen(false)}>{t('rentals.start.notYet', 'Not yet')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function MoneyIcon({ icon }: { icon: 'card' | 'momo' | 'wallet' }) {
  if (icon === 'momo') return <PhoneIphone fontSize="small" color="action" />;
  if (icon === 'wallet') return <AccountBalanceWallet fontSize="small" color="action" />;
  return <CreditCard fontSize="small" color="action" />;
}

function titleText(
  phase: string,
  role: string,
  name: string | undefined,
  when: string,
  time: string,
  startedAt: string | null | undefined,
  zone: string,
  t: (key: string, fallback: string, vars?: Record<string, string>) => string,
  language: string,
  payAtPickup = false
): string {
  if (role === 'business' && phase !== 'started') {
    return waitingForRenterTitle(name || 'the renter', language, t);
  }
  if (phase === 'started') {
    const at = startedAt ? formatZonedTime(startedAt, zone, language, zone) : time;
    if (role === 'business' && payAtPickup) {
      return t('rentals.payAtPickup.businessPaid', 'Paid at {{time}} · hand over the item', { time: at });
    }
    return role === 'business'
      ? t('rentals.business.startedLine', 'Started at {{time}} · hand over the item', { time: at })
      : t('rentals.start.startedBanner', 'Rental started at {{time}}. The business has been notified to hand over the item.', { time: at });
  }
  if (phase === 'before') return t('rentals.start.pickupOn', 'Pickup on {{when}} · {{time}}', { when, time });
  return t('rentals.start.todayTitle', 'Pick up your item · {{time}}', { time });
}

function bodyText(phase: string, role: string, momo: boolean, t: (key: string, fallback: string) => string, card = false, payAtPickup = false): string {
  if (role === 'business' && phase !== 'started' && payAtPickup) {
    return t('rentals.payAtPickup.businessWaitingBody', 'The renter checks the item and pays here. Don’t hand over the item until you see “Paid”.');
  }
  if (phase === 'started') return '';
  if (role === 'business' && phase !== 'started') {
    return t('rentals.business.waitingBody', 'Hand over the item only after you get “Rental started”. No PIN needed.');
  }
  if (phase === 'before') return t('rentals.start.beforeBody', 'You can start the rental on the pickup day, once you are at the business.');
  if (card || momo) return t('rentals.payAtPickup.cardBody', 'At the business, check the item, then tap Pay & start. They hand over the item once the payment goes through.');
  if (momo) return t('rentals.start.momoBody', 'At the business, tap Start rental. You pay then, and they hand over the item once the payment goes through.');
  return t('rentals.start.todayBody', 'At the business, tap Start rental. They hand over the item once you start.');
}
