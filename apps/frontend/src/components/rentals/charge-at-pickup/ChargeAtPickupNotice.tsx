import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type ChargeNoticeKind =
  | 'save_card'
  | 'before_pickup'
  | 'decline'
  | 'renewal_failed'
  | 'remainder'
  | 'released'
  | 'business_started'
  | 'business_failed'
  | 'business_renewal'
  | 'business_remainder';

export interface ChargeNoticeModel {
  kind: ChargeNoticeKind;
  itemName: string;
  place: string;
  bookingNumber: string;
  rent: string;
  deposit: string;
  when: string;
  period?: string;
  heldUntil?: string;
  overtime?: string;
  damage?: string;
  remainder?: string;
  cardLabel?: string;
  onSaveCard?: () => void;
  onPayRemainder?: () => void;
  onUpdateCard?: () => void;
  onRetry?: () => void;
  hideActions?: boolean;
}

const BLUE = '#0A4FB5';

export function ChargeAtPickupNotice({ model }: { model: ChargeNoticeModel }) {
  const { t } = useTranslation();
  if (model.kind === 'save_card') return <SaveCard model={model} t={t} />;
  if (model.kind === 'before_pickup') return <BeforePickup model={model} t={t} />;
  if (model.kind === 'decline') return <Decline model={model} t={t} />;
  if (model.kind === 'renewal_failed') return <Renewal model={model} t={t} />;
  if (model.kind === 'remainder') return <Remainder model={model} t={t} />;
  if (model.kind === 'released') return <Released model={model} t={t} />;
  return <Business model={model} t={t} />;
}

export function ChargeAtPickupPayLine({ rent, deposit }: { rent: string; deposit: string }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ bgcolor: '#E8F1FC', borderRadius: 2, px: 2, py: 1.5 }}>
      <Typography textAlign="center" color={BLUE} fontWeight={600}>
        {t('rentalInspection.chargeAndHold', "You'll pay {{rent}} now. We will hold {{deposit}} as a deposit until the condition review ends.", { rent, deposit })}
      </Typography>
    </Box>
  );
}

function SaveCard({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Stack spacing={1.25}>
      <Info>
        {t(
          'rentalInspection.acceptedSaveCard',
          'The business accepted your request. Save a card to keep this reservation.'
        )}
      </Info>
      <Card>
        <Typography fontWeight={800}>{model.itemName}</Typography>
        <Typography variant="body2" color="text.secondary">{model.place}</Typography>
        <Row label={t('rentals.bookingDetail.period', 'Dates')} value={model.period ?? model.when} />
        <Row label={t('rentals.bookingDetail.rental', 'Rental')} value={model.rent} />
        <Row label={t('rentals.bookingDetail.securityDeposit', 'Deposit')} value={model.deposit} />
      </Card>
      <Card>
        <Stack direction="row" spacing={1} alignItems="center">
          <LockOutlinedIcon sx={{ color: BLUE }} />
          <Typography fontWeight={800}>{t('rentalInspection.cardDetails', 'Card details')}</Typography>
        </Stack>
        <Field k={t('rentalInspection.cardNumber', 'Card number')} v={model.cardLabel ?? '•••• •••• •••• 4242'} />
        <Stack direction="row" spacing={1}>
          <Field k={t('rentalInspection.cardExpiry', 'Expiry')} v="12 / 28" />
          <Field k="CVC" v="•••" />
        </Stack>
        <Typography variant="body2" color={BLUE} sx={{ mt: 1.5, lineHeight: 1.45 }}>
          {mandate(t, model)}
        </Typography>
      </Card>
      <Button
        variant="contained"
        startIcon={<CreditCardIcon />}
        onClick={model.onSaveCard}
        sx={blueButton}
      >
        {t('rentalInspection.saveCard', 'Save card')}
      </Button>
    </Stack>
  );
}

function BeforePickup({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Card>
      <Typography fontWeight={800}>{model.itemName}</Typography>
      <Typography variant="body2" color="text.secondary">{model.bookingNumber} · {model.place}</Typography>
      <Typography variant="body2" color={BLUE} sx={{ mt: 1.5, lineHeight: 1.5 }}>
        {t('rentalInspection.beforePickup', 'At pickup we will charge {{rent}} and hold {{deposit}} as a deposit. Nothing is charged now. You can cancel for free until {{when}}.', { rent: model.rent, deposit: model.deposit, when: model.when })}
      </Typography>
      {model.cardLabel ? <Typography sx={{ mt: 1 }} fontWeight={700}>{model.cardLabel}</Typography> : null}
    </Card>
  );
}

function Decline({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Stack spacing={1.25}>
      <Box sx={{ bgcolor: '#FEE2E2', borderRadius: 2, p: 1.5 }}>
        <Typography color="#7F1D1D" fontWeight={700}>
          {t('rentalInspection.declined', 'Your card was declined. Update your card or try again. The item stays with the business until payment succeeds. This reservation is held until {{when}}.', { when: model.heldUntil ?? model.when })}
        </Typography>
      </Box>
      {model.hideActions ? null : (
        <>
          <Button variant="contained" startIcon={<CreditCardIcon />} onClick={model.onUpdateCard} sx={blueButton}>
            {t('rentalInspection.updateCard', 'Update card')}
          </Button>
          <Button variant="outlined" onClick={model.onRetry} sx={{ minHeight: 48, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            {t('rentalInspection.retryCharge', 'Try again')}
          </Button>
        </>
      )}
    </Stack>
  );
}

function Renewal({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Box sx={{ bgcolor: '#FEF3C7', borderRadius: 2, p: 1.5 }}>
      <Typography color="#7C3D0A" fontWeight={700}>
        {t('rentalInspection.renewalFailed', 'Update your card to renew the {{deposit}} deposit hold. Your rental continues. Support has been notified.', { deposit: model.deposit })}
      </Typography>
      <Button startIcon={<CreditCardIcon />} onClick={model.onUpdateCard} sx={{ color: BLUE, px: 0, textTransform: 'none', fontWeight: 800 }}>
        {t('rentalInspection.updateYourCard', 'Update your card')}
      </Button>
    </Box>
  );
}

function Remainder({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Stack spacing={1.5}>
      <Typography>
        {t('rentalInspection.remainder', 'The {{deposit}} deposit covered {{overtime}} in overtime and {{damage}} in damage. {{remainder}} remains to pay.', {
          deposit: model.deposit,
          overtime: model.overtime ?? '',
          damage: model.damage ?? '',
          remainder: model.remainder ?? '',
        })}
      </Typography>
      {model.hideActions ? null : (
        <Button variant="contained" onClick={model.onPayRemainder} sx={blueButton}>
          {t('rentalInspection.payRemainder', 'Pay {{amount}}', { amount: model.remainder ?? '' })}
        </Button>
      )}
    </Stack>
  );
}

function Released({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  return (
    <Typography>
      {t('rentalInspection.depositReleased', 'The {{deposit}} deposit has been released. Thank you for returning the item.', { deposit: model.deposit })}
    </Typography>
  );
}

function Business({ model, t }: { model: ChargeNoticeModel; t: Translate }) {
  if (model.kind === 'business_failed') {
    return <Typography color="#B42318" fontWeight={700}>{t('rentalInspection.businessFailed', "The renter's payment failed. Do not hand over the item until payment succeeds.")}</Typography>;
  }
  if (model.kind === 'business_renewal') {
    return <Typography>{t('rentalInspection.businessRenewal', 'The deposit hold could not be renewed. Support is following up. The rental continues.')}</Typography>;
  }
  if (model.kind === 'business_remainder') {
    return <Typography>{t('rentalInspection.businessRemainder', 'A remainder of {{amount}} has been invoiced to the renter.', { amount: model.remainder ?? '' })}</Typography>;
  }
  return (
    <Stack spacing={1} alignItems="center">
      <Typography variant="h6" fontWeight={800} textAlign="center">{t('rentalInspection.businessStartedTitle', 'Started, hand over the item')}</Typography>
      <Typography textAlign="center" color="text.secondary">
        {t('rentalInspection.businessStarted', '{{rent}} has been charged. A {{deposit}} deposit is held until the condition review ends.', { rent: model.rent, deposit: model.deposit })}
      </Typography>
    </Stack>
  );
}

function Info({ children }: { children: string }) {
  return <Box sx={{ bgcolor: '#EEF3FB', borderRadius: 2, p: 1.5 }}><Typography color={BLUE}>{children}</Typography></Box>;
}

function Card({ children }: { children: ReactNode }) {
  return <Box sx={{ bgcolor: '#fff', border: '1px solid #E6E1D8', borderRadius: 3, p: 2 }}>{children}</Box>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75, borderTop: '1px solid #EFEAE2' }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={800}>{value}</Typography>
    </Stack>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <Box sx={{ flex: 1, bgcolor: '#F4F1EC', borderRadius: 2, px: 1.5, py: 1, mt: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4 }}>
        {k.toUpperCase()}
      </Typography>
      <Typography fontWeight={700}>{v}</Typography>
    </Box>
  );
}

function mandate(t: Translate, model: ChargeNoticeModel): string {
  return t(
    'rentalInspection.saveCardMandate',
    'Nothing is charged until pickup. By saving your card, you allow Rendasua to charge {{rent}} at pickup on {{when}}, and to place and renew a {{deposit}} hold for the security deposit until the condition review ends. You can cancel for free before pickup.',
    { rent: model.rent, deposit: model.deposit, when: model.when }
  );
}

const blueButton = {
  bgcolor: BLUE,
  minHeight: 48,
  borderRadius: 2,
  textTransform: 'none',
  fontWeight: 700,
} as const;

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

function formatCardStamp(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Douala',
  }).format(date);
  const time = new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Africa/Douala',
  }).format(date);
  return `${day} · ${time}`;
}

function formatCardWindow(start: string, end: string | null | undefined, lang: string): string {
  const from = formatCardStamp(start, lang);
  if (!end) return from;
  return `${from} → ${formatCardStamp(end, lang)}`;
}

export function chargeNoticeKind(input: {
  persona: 'client' | 'business';
  cardSaved: boolean;
  failure?: string | null;
  renewal?: string | null;
  remainderStatus?: string | null;
  settled: boolean;
  started: boolean;
}): ChargeNoticeKind {
  if (input.persona === 'business') {
    if (input.failure) return 'business_failed';
    if (input.renewal === 'failed' || input.renewal === 'needs_action' || input.renewal === 'escalated') {
      return 'business_renewal';
    }
    if (input.remainderStatus === 'invoiced' || input.remainderStatus === 'overdue') return 'business_remainder';
    return 'business_started';
  }
  if (input.failure) return 'decline';
  if (input.renewal === 'failed' || input.renewal === 'needs_action' || input.renewal === 'escalated') {
    return 'renewal_failed';
  }
  if (input.remainderStatus === 'invoiced' || input.remainderStatus === 'overdue') return 'remainder';
  if (input.settled) return 'released';
  if (!input.cardSaved) return 'save_card';
  return input.started ? 'released' : 'before_pickup';
}

export function chargeNoticeModel(
  booking: {
    card_payment_mode?: string | null;
    booking_number?: string | null;
    start_at: string;
    total_amount: number;
    security_deposit_amount?: number | string | null;
    card_saved_at?: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
    deposit_renewal_status?: string | null;
    remainder_status?: string | null;
    remainder_amount?: number | string | null;
    remainder_overtime_covered?: number | string | null;
    remainder_damage_covered?: number | string | null;
    deposit_settled_at?: string | null;
    pickup_payment_failure_code?: string | null;
    actual_start_at?: string | null;
    end_at?: string | null;
    rental_location_listing?: { rental_item?: { name?: string | null } | null; business_location?: { name?: string | null } | null } | null;
  },
  isBusiness: boolean,
  money: (amount: number) => string,
  lang = 'en'
): ChargeNoticeModel {
  const rent = money(Number(booking.total_amount) || 0);
  const deposit = money(Number(booking.security_deposit_amount) || 0);
  const kind = chargeNoticeKind({
    persona: isBusiness ? 'business' : 'client',
    cardSaved: !!booking.card_saved_at,
    failure: booking.pickup_payment_failure_code,
    renewal: booking.deposit_renewal_status,
    remainderStatus: booking.remainder_status,
    settled: !!booking.deposit_settled_at,
    started: !!booking.actual_start_at,
  });
  return {
    kind,
    itemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
    place: booking.rental_location_listing?.business_location?.name ?? '',
    bookingNumber: booking.booking_number ?? '',
    rent,
    deposit,
    when: formatCardStamp(booking.start_at, lang),
    period: formatCardWindow(booking.start_at, booking.end_at, lang),
    overtime: money(Number(booking.remainder_overtime_covered) || 0),
    damage: money(Number(booking.remainder_damage_covered) || 0),
    remainder: money(Number(booking.remainder_amount) || 0),
    cardLabel: booking.card_last4 ? `${booking.card_brand ?? 'Card'} •••• ${booking.card_last4}` : undefined,
  };
}
