import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { declineAmount, declineDay, momoRail } from './declinePickup.format';

const { colors, spacing } = theme;

export type DeclineReason = 'damaged' | 'missing_accessory' | 'not_the_item' | 'other';
const REASONS: DeclineReason[] = ['damaged', 'missing_accessory', 'not_the_item', 'other'];

export interface DeclinePhoto {
  slotKey: string;
  url: string;
  capturedAt: string;
}

export interface DeclineMoney {
  rail: 'card' | 'wallet' | 'momo_unpaid' | 'momo_paid';
  amount: number;
  currency: string;
  timeZone: string;
  phoneMask?: string | null;
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

export function DeclineOutcomeCard({ money, refundStatus }: { money: DeclineMoney; refundStatus: 'none' | 'refund_pending' | 'refunded' }) {
  const { t, i18n } = useTranslation();
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  const title = refundStatus === 'refund_pending'
    ? t('pickupDecline.refundProgress', 'Refund in progress')
    : refundStatus === 'refunded'
      ? t('pickupDecline.refunded', 'Refunded')
      : t('pickupDecline.cancelledTitle', 'Booking cancelled');
  return (
    <View style={styles.pad}>
      <MaterialCommunityIcons name="cash-refund" size={36} color={colors.primary.main} />
      <Text variant="headlineSmall">{title}</Text>
      <Text>{money.place} · {money.bookingNumber}</Text>
      <Text>{outcomeBody(money, amount, refundStatus, t)}</Text>
      <Button mode="contained" buttonColor={colors.primary.main}>{t('pickupDecline.browse', 'Browse rentals')}</Button>
    </View>
  );
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
      <PhotoGroup label={t('pickupDecline.renterPhotos', "Renter's photos")} photos={photos} timeZone={timeZone} />
      {onViewBooking ? (
        <Button textColor={colors.primary.main} onPress={onViewBooking}>{t('pickupDecline.viewBooking', 'View booking')}</Button>
      ) : null}
    </View>
  );
}

export function ConditionPhotoStrip({ photos, timeZone }: { photos: DeclinePhoto[]; timeZone: string }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.row}>
      {photos.map((photo) => {
        const day = declineDay(photo.capturedAt, timeZone, i18n.language);
        const label = t(`pickupDecline.slots.${photo.slotKey}`, photo.slotKey);
        return (
          <View key={photo.slotKey} style={styles.tile}>
            <Image source={{ uri: photo.url }} accessibilityLabel={label} style={styles.image} />
            <Text variant="labelSmall">{label}</Text>
            <Text variant="labelSmall">{t('pickupDecline.captured', 'Captured {{date}}', { date: day })}</Text>
          </View>
        );
      })}
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
  return t('rentalInspection.heldAmount', '{{amount}} held', { amount });
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

function PhotoGroup({ label, photos, timeZone }: { label: string; photos: DeclinePhoto[]; timeZone: string }) {
  return (
    <View>
      <Text variant="titleSmall">{label}</Text>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} />
    </View>
  );
}

function moneyLine(money: DeclineMoney, amount: string, t: any): string {
  if (money.rail === 'momo_paid' && momoRail(money.currency, money.rail)) {
    return t('pickupDecline.momoPaid', "We'll refund {{amount}} to {{phone}}.", { amount, phone: money.phoneMask ?? '' });
  }
  if (money.rail === 'momo_unpaid' && momoRail(money.currency, money.rail)) {
    return t('pickupDecline.momoUnpaid', "You haven't paid anything.");
  }
  if (money.rail === 'wallet') return t('pickupDecline.walletMoney', 'The hold on your wallet is released. You will not be charged.');
  return t('pickupDecline.cardMoney', 'Your card hold of {{amount}} is released. You will not be charged.', { amount });
}

function outcomeBody(money: DeclineMoney, amount: string, refundStatus: string, t: any): string {
  if (refundStatus === 'refund_pending') {
    return t('pickupDecline.refundProgressBody', '{{amount}} is on its way to {{phone}}.', { amount, phone: money.phoneMask ?? '' });
  }
  if (refundStatus === 'refunded') {
    return t('pickupDecline.refundedBody', '{{amount}} was sent to {{phone}}.', { amount, phone: money.phoneMask ?? '' });
  }
  return moneyLine(money, amount, t);
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12, backgroundColor: colors.background.default },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: colors.error.main },
  tile: { width: 104, alignItems: 'center' },
  image: { width: 96, height: 96, borderRadius: 8 },
});
