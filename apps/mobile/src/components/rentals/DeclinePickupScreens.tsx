import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { declineAmount, declineDay } from './declinePickup.format';

const { colors, spacing } = theme;

export type DeclineReason = 'damaged' | 'missing_accessory' | 'not_the_item' | 'other';
const REASONS: DeclineReason[] = ['damaged', 'missing_accessory', 'not_the_item', 'other'];

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
  refundSent?: boolean;
  place: string;
  item: string;
  bookingNumber: string;
}

const REASON_COPY: Record<DeclineReason, [string, string]> = {
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
  onDecline,
}: {
  acceptLabel: string;
  reportLabel: string;
  showDecline: boolean;
  reportDanger: boolean;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      <Button mode="contained" buttonColor={colors.primary.main}>{acceptLabel}</Button>
      <Button mode="outlined" textColor={reportDanger ? colors.error.main : colors.text.primary}>
        {reportLabel}
      </Button>
      {showDecline ? (
        <Button textColor={colors.error.main} onPress={onDecline}>
          {t('pickupDecline.cta', 'Not as described? Decline')}
        </Button>
      ) : null}
    </View>
  );
}

export function DeclineReviewScreen({ money, photos, onDecline }: { money: DeclineMoney; photos: DeclinePhoto[]; onDecline: () => void }) {
  const { t, i18n } = useTranslation();
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text variant="titleLarge">{money.item}</Text>
      <Text>{money.place} · {money.bookingNumber}</Text>
      <ConditionPhotoStrip photos={photos} timeZone={money.timeZone} />
      <Text>{reviewLine(money, amount, t)}</Text>
      <DeclineReviewActions
        acceptLabel={t('rentalInspection.acceptAndStart', 'Accept condition & start rental')}
        reportLabel={t('rentalInspection.reportProblem', 'Report a problem')}
        showDecline
        reportDanger={false}
        onDecline={onDecline}
      />
    </ScrollView>
  );
}

export interface DeclineShot {
  id: string;
  url: string;
}

export function DeclineConditionSheet({
  money,
  onClose,
  initialReason = 'damaged',
  initialText = '',
  initialPhotos = [],
}: {
  money: DeclineMoney;
  onClose: () => void;
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
    <ScrollView contentContainerStyle={styles.pad}>
      <Text variant="titleLarge">{t('pickupDecline.title', 'Decline this rental?')}</Text>
      <Text>{money.place} · {money.bookingNumber}</Text>
      <Text>{t('pickupDecline.lead', 'The booking is cancelled and the unit is freed.')}</Text>
      <ReasonRow reason={reason} onChange={setReason} />
      {reason === 'other' ? (
        <TextInput mode="outlined" label={t('pickupDecline.otherPlaceholder', 'What is different?')} value={text} onChangeText={setText} multiline />
      ) : null}
      <PhotoButtons />
      <ShotRow shots={shots} onRemove={(id) => setShots((rows) => rows.filter((row) => row.id !== id))} />
      <Text>{moneyLine(money, amount, t)}</Text>
      <Button mode="contained" buttonColor={colors.error.main} disabled={otherBlocked}>{t('pickupDecline.confirm', 'Decline')}</Button>
      <Button textColor={colors.primary.main} onPress={onClose}>{t('pickupDecline.keep', 'Keep reviewing')}</Button>
    </ScrollView>
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
    refundSent?: boolean;
  } | null;
}) {
  const decline = booking.condition_decline;
  const credited = Boolean(decline?.walletCredited) && declineRefundView(booking.refund_status) !== 'refunded';
  return {
    rail: decline?.rail ?? 'unknown',
    amount: Number(decline?.amount) || Number(booking.refund_amount) || Number(booking.authorized_amount) || 0,
    currency: decline?.currency || booking.refund_currency || booking.currency,
    phoneMask: decline?.phoneMask ?? null,
    refundSent: decline?.refundSent,
    refundStatus: credited ? 'manual' as const : declineRefundView(booking.refund_status),
  };
}

type OutcomeCardProps = {
  money: DeclineMoney;
  refundStatus: DeclineRefundView;
  onViewWallet?: () => void;
  onBrowse?: () => void;
  onContactSupport?: () => void;
};

export function DeclineOutcomeCard({ money, refundStatus, onViewWallet, onBrowse, onContactSupport }: OutcomeCardProps) {
  const { t, i18n } = useTranslation();
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  const wallet = refundStatus === 'failed' || refundStatus === 'manual';
  const checking = refundStatus === 'refund_pending' && money.refundSent === false;
  return (
    <View style={styles.pad}>
      {outcomeMark(wallet, checking)}
      <Text variant="headlineSmall">{outcomeTitle(refundStatus, t)}</Text>
      <Text>{money.place} · {money.bookingNumber}</Text>
      <Text>{outcomeBody(money, amount, refundStatus, t)}</Text>
      <OutcomeActions wallet={wallet} checking={checking} onViewWallet={onViewWallet} onBrowse={onBrowse} onSupport={onContactSupport} />
    </View>
  );
}

function outcomeMark(wallet: boolean, checking: boolean) {
  if (wallet) return <WalletMark />;
  if (checking) return <CheckingMark />;
  return <MaterialCommunityIcons name="cash-refund" size={36} color={colors.primary.main} />;
}

export function BusinessDeclineBanner({
  reason,
  note,
  photos,
  baselinePhotos = [],
  timeZone,
  onViewBooking,
}: {
  reason: string;
  note?: string | null;
  photos: DeclinePhoto[];
  baselinePhotos?: DeclinePhoto[];
  timeZone: string;
  onViewBooking?: () => void;
}) {
  const { t } = useTranslation();
  const pair = REASON_COPY[reason as DeclineReason];
  const reasonLabel = pair ? t(pair[0], pair[1]) : reason;
  return (
    <View style={styles.pad}>
      <Text variant="titleLarge">{t('pickupDecline.businessTitle', 'Renter declined the condition')}</Text>
      <Text>{t('pickupDecline.businessBody', 'The booking is cancelled and the unit is free. No charge.')}</Text>
      <Text>{t('pickupDecline.reasonLine', 'Reason: {{reason}}', { reason: reasonLabel })}</Text>
      {note?.trim() ? <Text>{t('pickupDecline.noteLine', 'Note: {{note}}', { note: note.trim() })}</Text> : null}
      {baselinePhotos.length > 0 ? <PhotoGroup label={t('pickupDecline.yourPickupPhotos', 'Your pickup photos')} photos={baselinePhotos} timeZone={timeZone} /> : null}
      <PhotoGroup label={t('pickupDecline.renterPhotos', "Renter's photos")} photos={photos} timeZone={timeZone} numbered />
      {onViewBooking ? (
        <Button textColor={colors.primary.main} onPress={onViewBooking}>{t('pickupDecline.viewBooking', 'View booking')}</Button>
      ) : null}
    </View>
  );
}

export function ConditionPhotoStrip({ photos, timeZone, numbered = false }: { photos: DeclinePhoto[]; timeZone: string; numbered?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.row}>
      {photos.map((photo, index) => (
        <MobilePhotoTile
          key={photo.slotKey || photo.url}
          photo={photo}
          index={index}
          day={declineDay(photo.capturedAt, timeZone, i18n.language)}
          numbered={numbered}
        />
      ))}
    </View>
  );
}

export function ConditionPhotoLightbox({ photos, timeZone }: { photos: DeclinePhoto[]; timeZone: string }) {
  const photo = photos[0];
  if (!photo) return null;
  return (
    <View style={styles.pad}>
      <ConditionPhotoStrip photos={[photo]} timeZone={timeZone} />
    </View>
  );
}

export function DeclinePushCopy() {
  const { t } = useTranslation();
  return (
    <View style={styles.pad}>
      <Text variant="titleMedium">{t('pickupDecline.pushTitleEn', 'Renter declined the condition')}</Text>
      <Text>
        {t(
          'pickupDecline.pushBodyEn',
          'Marie declined the condition of JBL PartyBox 310 (RB-25496259). The booking is cancelled and the unit is free. No charge.'
        )}
      </Text>
      <Text variant="titleMedium">{t('pickupDecline.pushTitleFr', 'Le locataire a refusé l’état des lieux')}</Text>
      <Text>
        {t(
          'pickupDecline.pushBodyFr',
          'Marie a refusé l’état des lieux de JBL PartyBox 310 (RB-25496259). La réservation est annulée et l’article est libre. Aucun frais.'
        )}
      </Text>
    </View>
  );
}

export function DeclineInsightsStat({ declines, pickups }: { declines: number; pickups: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View>
        <Text variant="headlineSmall">{declines}</Text>
        <Text>{t('pickupDecline.insights', 'Condition declines (90 days)')}</Text>
      </View>
      <View>
        <Text variant="headlineSmall">{pickups}</Text>
        <Text>{t('pickupDecline.pickups', 'Pickups reached (90 days)')}</Text>
      </View>
    </View>
  );
}

export function DeclineAdminTable({ rows, timeZone }: { rows: Array<{ name: string; role: string; declineCount: number; pickupsReached: number | null; lastDeclineAt: string; flagged: boolean }>; timeZone: string }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.pad}>
      <Text variant="titleLarge">{t('pickupDecline.adminTitle', 'Condition declines')}</Text>
      <Text>{t('pickupDecline.adminSub', 'A flag appears at 5 or more declines in 90 days.')}</Text>
      {rows.map((row) => (
        <Text key={row.name}>
          {row.name} · {row.declineCount}{row.flagged ? ` · ${t('pickupDecline.flag', 'Flag')}` : ''} · {row.pickupsReached ?? '—'} · {declineDay(row.lastDeclineAt, timeZone, i18n.language)}
        </Text>
      ))}
    </View>
  );
}

function reviewLine(money: DeclineMoney, amount: string, t: any): string {
  if (money.rail === 'momo_unpaid') return t('rentalInspection.payNow', "You'll pay {{amount}} now", { amount });
  if (money.rail === 'momo_paid') return t('rentalInspection.paidAmount', '{{amount}} paid', { amount });
  if (money.rail === 'card') return t('pickupDecline.cardHold', 'Card hold: {{amount}}', { amount });
  return t('rentalInspection.heldAmount', '{{amount}} held', { amount });
}

function MobilePhotoTile({
  photo,
  index,
  day,
  numbered,
}: {
  photo: DeclinePhoto;
  index: number;
  day: string;
  numbered: boolean;
}) {
  const { t } = useTranslation();
  const label = numbered
    ? t('pickupDecline.photoNumber', 'Photo {{n}} · {{date}}', { n: index + 1, date: day })
    : t(`pickupDecline.slots.${photo.slotKey}`, photo.slotKey);
  return (
    <View style={styles.tile}>
      <Image source={{ uri: photo.url }} accessibilityLabel={label} style={styles.image} />
      <Text variant="labelSmall">{label}</Text>
      {numbered ? null : <Text variant="labelSmall">{t('pickupDecline.captured', 'Captured {{date}}', { date: day })}</Text>}
    </View>
  );
}

function ReasonRow({ reason, onChange }: { reason: DeclineReason; onChange: (reason: DeclineReason) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {REASONS.map((code) => (
        <Pressable key={code} onPress={() => onChange(code)} style={[styles.chip, reason === code ? styles.chipOn : null]}>
          <Text style={{ color: reason === code ? colors.error.main : colors.text.primary }}>{t(REASON_COPY[code][0], REASON_COPY[code][1])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PhotoButtons() {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Button mode="outlined" textColor={colors.primary.main} icon={() => <MaterialCommunityIcons name="camera" size={18} color={colors.primary.main} />}>
        {t('pickupDecline.camera', 'Camera')}
      </Button>
      <Button mode="outlined" textColor={colors.primary.main} icon={() => <MaterialCommunityIcons name="image" size={18} color={colors.primary.main} />}>
        {t('pickupDecline.gallery', 'Gallery')}
      </Button>
    </View>
  );
}

function ShotRow({ shots, onRemove }: { shots: DeclineShot[]; onRemove: (id: string) => void }) {
  const { t } = useTranslation();
  if (shots.length === 0) return null;
  return (
    <View style={styles.row}>
      {shots.map((shot) => (
        <View key={shot.id} style={styles.tile}>
          <Image source={{ uri: shot.url }} style={styles.image} />
          <Pressable onPress={() => onRemove(shot.id)} accessibilityLabel={t('pickupDecline.removePhoto', 'Remove photo')}>
            <Text style={{ color: colors.primary.main }}>{t('pickupDecline.removePhoto', 'Remove photo')}</Text>
          </Pressable>
        </View>
      ))}
    </View>
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
    <View>
      <Text variant="titleSmall">{label}</Text>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} numbered={numbered} />
    </View>
  );
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

function checkingCopy(amount: string, t: any): string {
  return t(
    'pickupDecline.refundChecking',
    "We're checking your refund of {{amount}}. We'll let you know as soon as it's in your wallet.",
    { amount }
  );
}

function sentLine(status: string, money: DeclineMoney, amount: string, t: any): string {
  if (status === 'refund_pending' && money.refundSent === false) return checkingCopy(amount, t);
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

function outcomeBody(money: DeclineMoney, amount: string, refundStatus: string, t: any): string {
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

function outcomeTitle(refundStatus: string, t: any): string {
  if (refundStatus === 'refund_pending') return t('pickupDecline.refundProgress', 'Refund in progress');
  if (refundStatus === 'refunded') return t('pickupDecline.refunded', 'Refunded');
  return t('pickupDecline.cancelledTitle', 'Booking cancelled');
}

function OutcomeActions(props: { wallet: boolean; checking: boolean; onViewWallet?: () => void; onBrowse?: () => void; onSupport?: () => void }) {
  const { t } = useTranslation();
  if (props.wallet) return <WalletActions onViewWallet={props.onViewWallet} onBrowse={props.onBrowse} />;
  return (
    <>
      <Button mode="contained" buttonColor={colors.primary.main} onPress={props.onBrowse}>{t('pickupDecline.browse', 'Browse rentals')}</Button>
      {props.checking ? <SupportLink onSupport={props.onSupport} /> : null}
    </>
  );
}

function WalletActions({ onViewWallet, onBrowse }: { onViewWallet?: () => void; onBrowse?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Button mode="contained" buttonColor={colors.primary.main} onPress={onViewWallet}>{t('pickupDecline.viewWallet', 'View wallet')}</Button>
      <Button mode="text" textColor={colors.primary.main} onPress={onBrowse}>{t('pickupDecline.browse', 'Browse rentals')}</Button>
    </>
  );
}

function SupportLink({ onSupport }: { onSupport?: () => void }) {
  const { t } = useTranslation();
  return (
    <Button mode="text" textColor={colors.primary.main} onPress={onSupport}>
      {t('pickupDecline.contactSupport', 'Contact support')}
    </Button>
  );
}

function WalletMark() {
  return (
    <View style={styles.mark}>
      <MaterialCommunityIcons name="wallet-outline" size={36} color={colors.primary.main} />
      <MaterialCommunityIcons name="check-circle" size={16} color="#0B7A3B" style={styles.badge} />
    </View>
  );
}

function CheckingMark() {
  return (
    <View style={styles.mark}>
      <MaterialCommunityIcons name="wallet-outline" size={36} color={colors.primary.main} />
      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.warning.main} style={styles.badge} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12, backgroundColor: colors.background.default },
  mark: { width: 40, height: 40 },
  badge: { position: 'absolute', right: -4, bottom: -2, backgroundColor: colors.background.default, borderRadius: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: colors.error.main },
  tile: { width: 104, alignItems: 'center' },
  image: { width: 96, height: 96, borderRadius: 8 },
});
