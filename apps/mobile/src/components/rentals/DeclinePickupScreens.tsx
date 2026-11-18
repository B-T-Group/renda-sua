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
      <Text>{moneyLine(money, amount, t)}</Text>
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

export function DeclineConditionSheet({ money, onClose }: { money: DeclineMoney; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState<DeclineReason>('damaged');
  const [text, setText] = useState('');
  const amount = declineAmount(money.amount, money.currency, i18n.language);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text variant="titleLarge">{t('pickupDecline.title', 'Decline this rental?')}</Text>
      <Text>{money.place} · {money.bookingNumber}</Text>
      <Text>{t('pickupDecline.lead', 'The booking is cancelled and the unit is freed.')}</Text>
      <View style={styles.row}>
        {REASONS.map((code) => (
          <Pressable key={code} onPress={() => setReason(code)} style={[styles.chip, reason === code ? styles.chipOn : null]}>
            <Text style={{ color: reason === code ? colors.error.main : colors.text.primary }}>
              {t(REASON_COPY[code][0], REASON_COPY[code][1])}
            </Text>
          </Pressable>
        ))}
      </View>
      {reason === 'other' ? (
        <TextInput
          mode="outlined"
          label={t('pickupDecline.otherPlaceholder', 'What is different?')}
          value={text}
          onChangeText={setText}
          multiline
        />
      ) : null}
      <View style={styles.row}>
        <Button mode="outlined" icon={() => <MaterialCommunityIcons name="camera" size={18} color={colors.text.primary} />}>
          {t('pickupDecline.camera', 'Camera')}
        </Button>
        <Button mode="outlined" icon={() => <MaterialCommunityIcons name="image" size={18} color={colors.text.primary} />}>
          {t('pickupDecline.gallery', 'Gallery')}
        </Button>
      </View>
      <Text>{moneyLine(money, amount, t)}</Text>
      <Button mode="contained" buttonColor={colors.error.main}>{t('pickupDecline.confirm', 'Decline')}</Button>
      <Button onPress={onClose}>{t('pickupDecline.keep', 'Keep reviewing')}</Button>
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
      <Button mode="contained">{t('pickupDecline.browse', 'Browse rentals')}</Button>
    </View>
  );
}

export function BusinessDeclineBanner({ reason, photos, timeZone }: { reason: string; photos: DeclinePhoto[]; timeZone: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.pad}>
      <Text variant="titleLarge">{t('pickupDecline.businessTitle', 'Renter declined the condition')}</Text>
      <Text>{t('pickupDecline.businessBody', 'The booking is cancelled and the unit is free. No charge.')}</Text>
      <Text>{reason}</Text>
      <ConditionPhotoStrip photos={photos} timeZone={timeZone} />
      <Text>{t('pickupDecline.unitFreed', 'Unit freed')}</Text>
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
