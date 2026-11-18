import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { declineAmount, declineDay } from './declinePickup.format';

export const DECLINE_REASONS = ['damaged', 'missing_accessory', 'not_the_item', 'other'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface DeclinePhoto {
  slotKey?: string;
  url: string;
  capturedAt: string;
}

export interface DeclineMoney {
  rail: 'card' | 'wallet' | 'momo_unpaid' | 'momo_paid' | 'unknown';
  amount: number;
  currency: string;
  timeZone: string;
  phoneMask?: string | null;
  place: string;
  item: string;
  bookingNumber: string;
}

const REASON_KEY: Record<DeclineReason, [string, string]> = {
  damaged: ['pickupDecline.reasons.damaged', 'Damaged'],
  missing_accessory: ['pickupDecline.reasons.missing_accessory', 'Missing accessories'],
  not_the_item: ['pickupDecline.reasons.not_the_item', 'Not the item shown'],
  other: ['pickupDecline.reasons.other', 'Other'],
};

export function DeclineReviewActions({
  acceptLabel,
  reportLabel,
  showDecline,
  reportDanger,
  disabled,
  onAccept,
  onReport,
  onDecline,
}: {
  acceptLabel: string;
  reportLabel: string;
  showDecline: boolean;
  reportDanger: boolean;
  disabled?: boolean;
  onAccept: () => void;
  onReport: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Button fullWidth variant="contained" sx={{ minHeight: 48 }} disabled={disabled} onClick={onAccept}>
        {acceptLabel}
      </Button>
      <Button
        fullWidth
        variant="outlined"
        color={reportDanger ? 'error' : 'inherit'}
        sx={{ minHeight: 48, ...(reportDanger ? {} : { color: 'text.primary', borderColor: 'divider' }) }}
        onClick={onReport}
      >
        {reportLabel}
      </Button>
      {showDecline ? (
        <Button fullWidth color="error" onClick={onDecline}>
          {t('pickupDecline.cta', 'Not as described? Decline')}
        </Button>
      ) : null}
    </Stack>
  );
}

export function DeclineReviewScreen({ money, photos, onDecline }: { money: DeclineMoney; photos: DeclinePhoto[]; onDecline: () => void }) {
  const { t, i18n } = useTranslation();
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 420 }}>
      <Typography variant="h6">{money.item}</Typography>
      <Typography color="text.secondary">{money.place} · {money.bookingNumber}</Typography>
      <ConditionPhotoStrip photos={photos} timeZone={money.timeZone} />
      <Typography>{reviewLine(money, amount, t)}</Typography>
      <DeclineReviewActions
        acceptLabel={t('rentalInspection.acceptAndStart', 'Accept condition & start rental')}
        reportLabel={t('rentalInspection.reportProblem', 'Report a problem')}
        showDecline
        reportDanger={false}
        onAccept={() => undefined}
        onReport={() => undefined}
        onDecline={onDecline}
      />
    </Stack>
  );
}

export function DeclineConditionSheet({
  open,
  money,
  onClose,
  onConfirm,
  initialReason = 'damaged',
  initialText = '',
  initialPhotos = [],
}: {
  open: boolean;
  money: DeclineMoney;
  onClose: () => void;
  onConfirm: (reason: DeclineReason, text: string) => void;
  initialReason?: DeclineReason;
  initialText?: string;
  initialPhotos?: DeclineShot[];
}) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState<DeclineReason>(initialReason);
  const [text, setText] = useState(initialText);
  const [shots, setShots] = useState<DeclineShot[]>(initialPhotos);
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  const otherBlocked = reason === 'other' && text.trim().length === 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="h6">{t('pickupDecline.title', 'Decline this rental?')}</Typography>
          <Typography color="text.secondary">{money.place} · {money.bookingNumber}</Typography>
          <Typography color="text.secondary">{t('pickupDecline.lead', 'The booking is cancelled and the unit is freed.')}</Typography>
          <ReasonChips reason={reason} onChange={setReason} />
          {reason === 'other' ? <OtherField text={text} onChange={setText} /> : null}
          <PhotoAddRow />
          <AddedShots shots={shots} onRemove={(id) => setShots((rows) => rows.filter((row) => row.id !== id))} />
          <Typography>{moneyLine(money, amount, t)}</Typography>
          <Button variant="contained" color="error" disabled={otherBlocked} onClick={() => onConfirm(reason, text)}>
            {t('pickupDecline.confirm', 'Decline')}
          </Button>
          <Button color="primary" onClick={onClose}>{t('pickupDecline.keep', 'Keep reviewing')}</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export type DeclineRefundView = 'none' | 'refund_pending' | 'refunded' | 'failed' | 'manual';

export function declineRefundView(status?: string | null): DeclineRefundView {
  if (status === 'refund_pending' || status === 'refunded' || status === 'failed' || status === 'manual') return status;
  return 'none';
}

export function declineCardView(booking: {
  currency: string;
  refund_status?: string | null;
  refund_amount?: number | string | null;
  refund_currency?: string | null;
  authorized_amount?: number | string | null;
  condition_decline?: {
    rail?: DeclineMoney['rail'];
    amount?: number;
    currency?: string | null;
    phoneMask?: string | null;
    walletCredited?: boolean;
  } | null;
}) {
  const decline = booking.condition_decline;
  const credited = Boolean(decline?.walletCredited) && declineRefundView(booking.refund_status) !== 'refunded';
  return {
    rail: decline?.rail ?? 'unknown',
    amount: Number(decline?.amount) || Number(booking.refund_amount) || Number(booking.authorized_amount) || 0,
    currency: decline?.currency || booking.refund_currency || booking.currency,
    phoneMask: decline?.phoneMask ?? null,
    refundStatus: credited ? 'manual' as const : declineRefundView(booking.refund_status),
  };
}

export function DeclineOutcomeCard({
  money,
  refundStatus,
  onViewWallet,
  onBrowse,
}: {
  money: DeclineMoney;
  refundStatus: DeclineRefundView;
  onViewWallet?: () => void;
  onBrowse?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  const wallet = refundStatus === 'failed' || refundStatus === 'manual';
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 420, width: '100%', mx: 'auto' }}>
      {wallet ? <WalletMark /> : <DeclineArt />}
      <Typography variant="h5">{outcomeTitle(refundStatus, t)}</Typography>
      <Typography color="text.secondary">{money.place} · {money.bookingNumber}</Typography>
      <Typography>{outcomeBody(money, amount, refundStatus, t)}</Typography>
      <OutcomeActions wallet={wallet} onViewWallet={onViewWallet} onBrowse={onBrowse} />
    </Stack>
  );
}

export function BusinessDeclineBanner({
  reason,
  note,
  photos,
  baselinePhotos = [],
  timeZone,
  bookingHref,
}: {
  reason: string;
  note?: string | null;
  photos: DeclinePhoto[];
  baselinePhotos?: DeclinePhoto[];
  timeZone: string;
  bookingHref?: string;
}) {
  const { t } = useTranslation();
  const pair = REASON_KEY[reason as DeclineReason];
  const reasonLabel = pair ? t(pair[0], pair[1]) : reason;
  return (
    <Stack spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="h6">{t('pickupDecline.businessTitle', 'Renter declined the condition')}</Typography>
      <Typography>{t('pickupDecline.businessBody', 'The booking is cancelled and the unit is free. No charge.')}</Typography>
      <Typography>{t('pickupDecline.reasonLine', 'Reason: {{reason}}', { reason: reasonLabel })}</Typography>
      {note?.trim() ? <Typography>{t('pickupDecline.noteLine', 'Note: {{note}}', { note: note.trim() })}</Typography> : null}
      {baselinePhotos.length > 0 ? <PhotoGroup label={t('pickupDecline.yourPickupPhotos', 'Your pickup photos')} photos={baselinePhotos} timeZone={timeZone} /> : null}
      <PhotoGroup label={t('pickupDecline.renterPhotos', "Renter's photos")} photos={photos} timeZone={timeZone} numbered />
      {bookingHref ? (
        <Button color="primary" href={bookingHref}>{t('pickupDecline.viewBooking', 'View booking')}</Button>
      ) : null}
    </Stack>
  );
}

export function ConditionPhotoStrip({
  photos,
  timeZone,
  onOpen,
  numbered = false,
}: {
  photos: DeclinePhoto[];
  timeZone: string;
  onOpen?: (index: number) => void;
  numbered?: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
      {photos.map((photo, index) => (
        <PhotoTile
          key={photo.slotKey || photo.url}
          photo={photo}
          index={index}
          day={declineDay(photo.capturedAt, timeZone, i18n.language)}
          numbered={numbered}
          onOpen={onOpen}
        />
      ))}
    </Stack>
  );
}

export function ConditionPhotoLightbox({ photos, index, timeZone, onClose }: { photos: DeclinePhoto[]; index: number | null; timeZone: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const photo = index == null ? null : photos[index];
  if (!photo) return null;
  const day = declineDay(photo.capturedAt, timeZone, i18n.language);
  const label = t(`pickupDecline.slots.${photo.slotKey}`, photo.slotKey);
  return (
    <Dialog open onClose={onClose} maxWidth="md">
      <DialogContent>
        <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
        <Box component="img" src={photo.url} alt={label} sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }} />
        <Typography align="center" sx={{ mt: 1 }}>{label}</Typography>
        <Typography align="center" color="text.secondary">{t('pickupDecline.captured', 'Captured {{date}}', { date: day })}</Typography>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineInsightsStat({ declines, pickups }: { declines: number; pickups: number }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={2} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Stack>
        <Typography variant="h5">{declines}</Typography>
        <Typography variant="caption">{t('pickupDecline.insights', 'Condition declines (90 days)')}</Typography>
      </Stack>
      <Stack>
        <Typography variant="h5">{pickups}</Typography>
        <Typography variant="caption">{t('pickupDecline.pickups', 'Pickups reached (90 days)')}</Typography>
      </Stack>
    </Stack>
  );
}

export interface DeclineAdminRow {
  name: string;
  role: 'renter' | 'business';
  declineCount: number;
  pickupsReached: number | null;
  lastDeclineAt: string;
  flagged: boolean;
}

export function DeclineAdminTable({ rows, timeZone }: { rows: DeclineAdminRow[]; timeZone: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      <Typography variant="h6">{t('pickupDecline.adminTitle', 'Condition declines')}</Typography>
      <Typography color="text.secondary">{t('pickupDecline.adminSub', 'A flag appears at 5 or more declines in 90 days.')}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('pickupDecline.party', 'Party')}</TableCell>
            <TableCell>{t('pickupDecline.role', 'Role')}</TableCell>
            <TableCell>{t('pickupDecline.declines', 'Declines (90 days)')}</TableCell>
            <TableCell>{t('pickupDecline.pickups', 'Pickups reached (90 days)')}</TableCell>
            <TableCell>{t('pickupDecline.last', 'Last decline')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.role}-${row.name}`} selected={row.flagged}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{t(`pickupDecline.${row.role}`, row.role)}</TableCell>
              <TableCell>{row.declineCount}{row.flagged ? ` · ${t('pickupDecline.flag', 'Flag')}` : ''}</TableCell>
              <TableCell>{row.pickupsReached ?? '—'}</TableCell>
              <TableCell>{declineDay(row.lastDeclineAt, timeZone, i18n.language)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

export function DeclinePushCopy() {
  const { t } = useTranslation();
  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480 }}>
      <PushBlock
        title={t('pickupDecline.pushTitleEn', 'Renter declined the condition')}
        body={t(
          'pickupDecline.pushBodyEn',
          'Marie declined the condition of JBL PartyBox 310 (RB-25496259). The booking is cancelled and the unit is free. No charge.'
        )}
      />
      <PushBlock
        title={t('pickupDecline.pushTitleFr', 'Le locataire a refusé l’état des lieux')}
        body={t(
          'pickupDecline.pushBodyFr',
          'Marie a refusé l’état des lieux de JBL PartyBox 310 (RB-25496259). La réservation est annulée et l’article est libre. Aucun frais.'
        )}
      />
    </Stack>
  );
}

function PushBlock({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <Typography fontWeight={700}>{title}</Typography>
      <Typography>{body}</Typography>
    </Box>
  );
}

function ReasonChips({ reason, onChange }: { reason: DeclineReason; onChange: (reason: DeclineReason) => void }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {DECLINE_REASONS.map((code) => (
        <Chip key={code} label={t(REASON_KEY[code][0], REASON_KEY[code][1])} color={reason === code ? 'error' : 'default'} onClick={() => onChange(code)} />
      ))}
    </Stack>
  );
}

function OtherField({ text, onChange }: { text: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextField
      label={t('pickupDecline.otherPlaceholder', 'What is different?')}
      helperText={t('pickupDecline.otherHint', 'Required when you choose Other.')}
      value={text}
      onChange={(event) => onChange(event.target.value)}
      multiline
      minRows={2}
    />
  );
}

function PhotoAddRow() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1}>
      <Button color="primary" variant="outlined" startIcon={<PhotoCameraOutlinedIcon />}>{t('pickupDecline.camera', 'Camera')}</Button>
      <Button color="primary" variant="outlined" startIcon={<PhotoLibraryOutlinedIcon />}>{t('pickupDecline.gallery', 'Gallery')}</Button>
    </Stack>
  );
}

function AddedShots({ shots, onRemove }: { shots: DeclineShot[]; onRemove: (id: string) => void }) {
  const { t } = useTranslation();
  if (shots.length === 0) return null;
  return (
    <Stack direction="row" spacing={1}>
      {shots.map((shot) => (
        <Box key={shot.id} sx={{ position: 'relative' }}>
          <Box component="img" src={shot.url} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, display: 'block' }} />
          <IconButton aria-label={t('pickupDecline.removePhoto', 'Remove photo')} size="small" onClick={() => onRemove(shot.id)} sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'background.paper' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Stack>
  );
}

function PhotoGroup({
  label,
  photos,
  timeZone,
  numbered = false,
}: {
  label: string;
  photos: DeclinePhoto[];
  timeZone: string;
  numbered?: boolean;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2">{label}</Typography>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} numbered={numbered} />
    </Stack>
  );
}

function PhotoTile({
  photo,
  index,
  day,
  numbered,
  onOpen,
}: {
  photo: DeclinePhoto;
  index: number;
  day: string;
  numbered: boolean;
  onOpen?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const label = tileCaption(numbered, index, photo.slotKey, day, t);
  return (
    <Stack spacing={0.5} alignItems="center" sx={{ width: numbered ? 128 : 112 }}>
      <Box component="button" onClick={() => onOpen?.(index)} sx={{ p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}>
        <Box component="img" src={photo.url} alt={label} sx={{ width: 104, height: 104, objectFit: 'cover', borderRadius: 1, display: 'block' }} />
      </Box>
      <Typography variant="caption" align="center">{label}</Typography>
      {numbered ? null : (
        <Typography variant="caption" color="text.secondary" align="center">
          {t('pickupDecline.captured', 'Captured {{date}}', { date: day })}
        </Typography>
      )}
    </Stack>
  );
}

function tileCaption(numbered: boolean, index: number, slotKey: string | undefined, day: string, t: any): string {
  if (numbered) return t('pickupDecline.photoNumber', 'Photo {{n}} · {{date}}', { n: index + 1, date: day });
  return t(`pickupDecline.slots.${slotKey}`, slotKey ?? '');
}

function outcomeTitle(refundStatus: DeclineRefundView, t: any): string {
  if (refundStatus === 'refund_pending') return t('pickupDecline.refundProgress', 'Refund in progress');
  if (refundStatus === 'refunded') return t('pickupDecline.refunded', 'Refunded');
  return t('pickupDecline.cancelledTitle', 'Booking cancelled');
}

function OutcomeActions({ wallet, onViewWallet, onBrowse }: { wallet: boolean; onViewWallet?: () => void; onBrowse?: () => void }) {
  const { t } = useTranslation();
  if (!wallet) return <Button variant="contained" color="primary" onClick={onBrowse}>{t('pickupDecline.browse', 'Browse rentals')}</Button>;
  return (
    <>
      <Button variant="contained" color="primary" onClick={onViewWallet}>{t('pickupDecline.viewWallet', 'View wallet')}</Button>
      <Button color="primary" onClick={onBrowse}>{t('pickupDecline.browse', 'Browse rentals')}</Button>
    </>
  );
}

function WalletMark() {
  return (
    <Box sx={{ position: 'relative', width: 40, height: 40 }} aria-hidden>
      <AccountBalanceWalletIcon sx={{ fontSize: 40, color: 'primary.main' }} />
      <CheckCircleIcon sx={{ position: 'absolute', right: -6, bottom: -2, fontSize: 18, color: '#0B7A3B', bgcolor: '#FAF9F7', borderRadius: '50%' }} />
    </Box>
  );
}

function DeclineArt() {
  return (
    <Box component="svg" viewBox="0 0 120 72" role="img" aria-label="" sx={{ width: 120, height: 72 }}>
      <rect x="18" y="16" width="52" height="40" rx="8" fill="#1B4DFF" />
      <circle cx="36" cy="36" r="10" fill="#FAF9F7" />
      <path d="M78 28h16l8 8v16a6 6 0 0 1-6 6H78z" fill="#12B76A" />
      <path d="M84 40l4 4 8-8" stroke="#FAF9F7" strokeWidth="2" fill="none" />
    </Box>
  );
}

export interface DeclineShot {
  id: string;
  url: string;
}

function reviewLine(money: DeclineMoney, amount: string, t: any): string {
  if (money.rail === 'momo_unpaid') return t('rentalInspection.payNow', "You'll pay {{amount}} now", { amount });
  if (money.rail === 'momo_paid') return t('rentalInspection.paidAmount', '{{amount}} paid', { amount });
  if (money.rail === 'card') return t('pickupDecline.cardHold', 'Card hold: {{amount}}', { amount });
  return t('rentalInspection.heldAmount', '{{amount}} held', { amount });
}

function moneyLine(money: DeclineMoney, amount: string, t: any): string {
  if (money.rail === 'unknown') return t('pickupDecline.neutralMoney', 'This booking is cancelled.');
  if (money.rail === 'momo_paid') return paidLine(money, amount, t);
  if (money.rail === 'momo_unpaid') return t('pickupDecline.momoUnpaid', "You haven't paid anything.");
  if (money.rail === 'wallet') return t('pickupDecline.walletMoney', 'The hold on your wallet is released. You will not be charged.');
  return t('pickupDecline.cardMoney', 'Your card hold of {{amount}} is released. You will not be charged.', { amount });
}

function paidLine(money: DeclineMoney, amount: string, t: any): string {
  const phone = (money.phoneMask ?? '').trim();
  if (!phone) return t('pickupDecline.momoPaidNoPhone', "We'll refund {{amount}}.", { amount });
  return t('pickupDecline.momoPaid', "We'll refund {{amount}} to {{phone}}.", { amount, phone });
}

function sentLine(status: string, money: DeclineMoney, amount: string, t: any): string {
  const phone = (money.phoneMask ?? '').trim();
  if (money.rail === 'momo_paid' && phone && status === 'refund_pending') {
    return t('pickupDecline.refundProgressBody', '{{amount}} is on its way to {{phone}}.', { amount, phone });
  }
  if (money.rail === 'momo_paid' && phone && status === 'refunded') {
    return t('pickupDecline.refundedBody', '{{amount}} was sent to {{phone}}.', { amount, phone });
  }
  if (status === 'refunded' && money.rail === 'momo_paid') {
    return t('pickupDecline.refundedNoPhone', '{{amount}} was refunded.', { amount });
  }
  if (money.rail === 'unknown') return t('pickupDecline.neutralMoney', 'This booking is cancelled.');
  return moneyLine(money, amount, t);
}

function outcomeBody(
  money: DeclineMoney,
  amount: string,
  refundStatus: string,
  t: any
): string {
  if (refundStatus === 'refund_pending' || refundStatus === 'refunded') {
    return sentLine(refundStatus, money, amount, t);
  }
  if (refundStatus === 'failed' || refundStatus === 'manual') {
    return t(
      'pickupDecline.walletReturned',
      "We couldn't send {{amount}} back to your Mobile Money number, so it's in your Rendasua wallet. You can withdraw it or use it on your next booking.",
      { amount }
    );
  }
  return moneyLine(money, amount, t);
}
