import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusPill } from '../../common/StatusPill';
import { useTheme } from '../../../contexts/ThemeContext';
import { trackSiteEvent } from '../../../services/analytics/AppEventsService';
import type { BusinessRentalRequestRow } from '../../../types/rentals';
import {
  buildRequestCardModel,
  type RequestCardModel,
} from '../../../utils/rentals/rentalRequestCardModel';

export interface BusinessRentalRequestCardProps {
  request: BusinessRentalRequestRow;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export function BusinessRentalRequestCard({
  request,
  onOpen,
  onAccept,
  onDecline,
}: BusinessRentalRequestCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const model = buildRequestCardModel(request, i18n.language, new Date(), t);
  const [openTimes, setOpenTimes] = useState(false);
  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          marginBottom: spacing.md,
        },
      ]}
    >
      <CardBody
        model={model}
        imageUri={requestThumbUri(request)}
        openTimes={openTimes}
        onToggleTimes={() => setOpenTimes((value) => !value)}
        onOpen={onOpen}
        openLabel={t('rentals.requestCard.openRequest', 'Open request for {{item}}', {
          item: model.itemName,
        })}
      />
      <RequestDecisionButtons
        requestId={request.id}
        acceptDisabled={model.acceptDisabled}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    </View>
  );
}

export function RequestDecisionButtons({
  requestId,
  acceptDisabled,
  onAccept,
  onDecline,
}: {
  requestId: string;
  acceptDisabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={[styles.actions, { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }]}>
      <Button
        mode="outlined"
        style={styles.action}
        onPress={() => {
          trackDecision('decline', requestId);
          onDecline();
        }}
        accessibilityLabel={t('rentals.actions.decline', 'Decline')}
      >
        {t('rentals.actions.decline', 'Decline')}
      </Button>
      <Button
        mode="contained"
        style={styles.action}
        disabled={acceptDisabled}
        onPress={() => {
          trackDecision('accept', requestId);
          onAccept();
        }}
        accessibilityLabel={
          acceptDisabled
            ? t(
                'rentals.requestCard.acceptUnavailable',
                'Accept, unavailable because this item is already booked for these dates.'
              )
            : t('rentals.actions.accept', 'Accept')
        }
      >
        {t('rentals.actions.accept', 'Accept')}
      </Button>
    </View>
  );
}

function trackDecision(kind: 'accept' | 'decline', requestId: string): void {
  trackSiteEvent({
    eventType:
      kind === 'accept' ? 'rental_request_card_accept_tap' : 'rental_request_card_decline_tap',
    metadata: { request_id: requestId },
  });
}

export function CardBody({
  model,
  imageUri,
  openTimes,
  onToggleTimes,
  fullNote,
  sections,
  onOpen,
  openLabel,
}: {
  model: RequestCardModel;
  imageUri?: string | null;
  openTimes?: boolean;
  onToggleTimes?: () => void;
  fullNote?: boolean;
  sections?: boolean;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const lead = (
    <>
      <ChipRow model={model} />
      <ItemRow model={model} imageUri={imageUri} />
      {model.changeDetail ? (
        <Text style={[styles.banner, { backgroundColor: colors.infoTint, color: colors.info.main, marginHorizontal: spacing.sm }]}>
          {t('rentals.modify.changed', 'Changed: {{detail}}', { detail: model.changeDetail })}
        </Text>
      ) : null}
      {model.acceptDisabled ? (
        <Text style={[styles.banner, { backgroundColor: colors.errorTint, color: colors.error.main, marginHorizontal: spacing.sm }]}>
          {t(
            'rentals.requestCard.bookedReason',
            'Already booked for these dates. You can decline, or the renter can pick new dates.'
          )}
        </Text>
      ) : null}
    </>
  );
  const rest = (
    <>
      {sections ? <SectionLabel label={t('rentals.requestCard.youReceiveHeading', 'You receive')} /> : null}
      <MoneyBlock model={model} />
      {sections ? <SectionLabel label={t('rentals.requestCard.renter', 'Renter')} /> : null}
      <RenterBlock model={model} fullNote={fullNote} />
      <Text style={[styles.sent, { color: colors.text.secondary, marginHorizontal: spacing.sm }]}>
        {t('rentals.requestCard.sent', 'Sent {{time}}', { time: model.sentClock })}
      </Text>
      <View style={{ height: spacing.xs }} />
    </>
  );
  return (
    <View style={{ paddingTop: spacing.sm }}>
      {onOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel={openLabel} onPress={onOpen}>
          {lead}
        </Pressable>
      ) : (
        lead
      )}
      {sections ? <SectionLabel label={t('rentals.requestCard.dates', 'Dates')} /> : null}
      <ScheduleBlock model={model} openTimes={openTimes} onToggleTimes={onToggleTimes} showAllLines={sections} />
      {onOpen ? (
        <Pressable accessible={false} onPress={onOpen}>
          {rest}
        </Pressable>
      ) : (
        rest
      )}
    </View>
  );
}

function ChipRow({ model }: { model: RequestCardModel }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const starts =
    model.startsIn?.kind === 'today'
      ? t('rentals.requestCard.startsToday', 'Starts today')
      : model.startsIn?.kind === 'days'
        ? t('rentals.requestCard.startsIn', 'Starts in {{count}} days', { count: model.startsIn.count })
        : null;
  return (
    <View style={[styles.chips, { paddingHorizontal: spacing.sm }]}>
      <StatusPill compact label={t('rentals.modify.requested', 'Requested')} backgroundColor={colors.warningTint} textColor={colors.warning.dark} />
      {model.updated ? (
        <StatusPill compact label={t('rentals.modify.updated', 'Updated')} backgroundColor={colors.infoTint} textColor={colors.info.main} />
      ) : null}
      {model.acceptDisabled ? (
        <StatusPill compact label={t('rentals.requestCard.alreadyBooked', 'Already booked')} backgroundColor={colors.errorTint} textColor={colors.error.main} />
      ) : starts ? (
        <StatusPill compact label={starts} backgroundColor={colors.surfaceSelected} textColor={colors.primary.main} />
      ) : null}
    </View>
  );
}

function ItemRow({ model, imageUri }: { model: RequestCardModel; imageUri?: string | null }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.item, { paddingHorizontal: spacing.sm, marginTop: spacing.xs }]}>
      <ListingThumb uri={imageUri} />
      <View style={styles.flex}>
        <Text variant="titleSmall" numberOfLines={2} style={{ color: colors.text.primary, fontWeight: '800' }}>
          {model.itemName}
          {model.quantity ? <Text style={{ color: colors.text.secondary }}>{` × ${model.quantity}`}</Text> : null}
        </Text>
        {model.place ? (
          <View style={styles.place}>
            <MaterialIcons name="place" size={14} color={colors.primary.main} testID="request-card-place-icon" />
            <Text numberOfLines={1} style={[styles.flex, { color: colors.text.secondary, marginLeft: 4, fontSize: 12 }]}>
              {model.place}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ListingThumb({ uri }: { uri?: string | null }) {
  const { colors, borderRadius } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={[styles.thumb, { borderRadius: borderRadius.icon }]} />;
  }
  return (
    <View style={[styles.thumb, styles.thumbEmpty, { borderRadius: borderRadius.icon, backgroundColor: colors.text.primary }]}>
      <MaterialCommunityIcons name="warehouse" size={22} color={colors.surface} />
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors, spacing } = useTheme();
  return (
    <Text style={{ color: colors.text.secondary, marginHorizontal: spacing.sm, marginTop: spacing.sm, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
      {label.toLocaleUpperCase()}
    </Text>
  );
}

function ScheduleBlock({
  model,
  openTimes,
  onToggleTimes,
  showAllLines,
}: {
  model: RequestCardModel;
  openTimes?: boolean;
  onToggleTimes?: () => void;
  showAllLines?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const showLines = showAllLines || (model.schedule.expandable && Boolean(openTimes));
  return (
    <View>
      <View style={[styles.block, { paddingHorizontal: spacing.sm }]}>
        <View style={[styles.ico, { backgroundColor: colors.surfaceSelected, borderRadius: borderRadius.icon }]}>
          <MaterialIcons name="event" size={16} color={colors.primary.main} testID="request-card-date-icon" />
        </View>
        <Text style={[styles.flex, { color: colors.text.primary, fontWeight: '800' }]}>{model.schedule.summary}</Text>
        {model.schedule.expandable && onToggleTimes ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              openTimes
                ? t('rentals.requestCard.hideTimes', 'Hide times')
                : t('rentals.requestCard.seeTimesA11y', 'See times')
            }
            onPress={onToggleTimes}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={openTimes ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.primary.main}
            />
          </Pressable>
        ) : null}
      </View>
      {showLines
        ? model.schedule.lines.map((line) => (
            <Text key={line} style={[styles.time, { color: colors.text.primary }]}>
              {line}
            </Text>
          ))
        : null}
    </View>
  );
}

function MoneyBlock({ model }: { model: RequestCardModel }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={[styles.block, { paddingHorizontal: spacing.sm }]}>
      <View style={[styles.ico, { backgroundColor: colors.cta.soft, borderRadius: borderRadius.icon }]}>
        <MaterialIcons name="account-balance-wallet" size={16} color={colors.cta.dark} testID="request-card-wallet-icon" />
      </View>
      <View style={styles.flex}>
        {model.quoteMissing ? (
          <Text style={{ color: colors.text.secondary }}>
            {t('rentals.requestCard.quoteUnavailable', 'Amount unavailable')}
          </Text>
        ) : (
          <Text style={{ color: colors.cta.dark, fontWeight: '800', fontSize: 16 }}>{model.receiveLine}</Text>
        )}
        {model.breakdown ? (
          <Text style={{ color: colors.text.secondary, marginTop: 2, fontSize: 12 }}>{model.breakdown}</Text>
        ) : null}
        {model.depositAmount ? (
          <Text style={{ color: colors.text.secondary, marginTop: 2, fontSize: 12 }}>
            {t('rentals.requestCard.deposit', 'Deposit: {{amount}}', { amount: model.depositAmount })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RenterBlock({ model, fullNote }: { model: RequestCardModel; fullNote?: boolean }) {
  const { colors, spacing } = useTheme();
  if (!model.renterName && !model.note) return null;
  return (
    <View>
      {model.renterName ? (
        <View style={[styles.renter, { paddingHorizontal: spacing.sm }]}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceSelected }]}>
            <Text style={{ color: colors.primary.main, fontWeight: '800', fontSize: 11 }}>{model.initials}</Text>
          </View>
          <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{model.renterName}</Text>
        </View>
      ) : null}
      {model.note ? (
        <Text
          numberOfLines={fullNote ? undefined : 2}
          style={{ color: colors.text.primary, marginHorizontal: spacing.sm, marginBottom: spacing.xs }}
        >
          {model.note}
        </Text>
      ) : null}
    </View>
  );
}

export function requestThumbUri(request: BusinessRentalRequestRow): string | null {
  const image = request.rental_location_listing.rental_item.rental_item_images?.[0];
  return image?.display_url || image?.thumbnail || image?.image_url || null;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  block: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  ico: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  time: { marginLeft: 54, marginTop: 4, fontWeight: '600' },
  renter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sent: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  banner: { marginTop: 10, padding: 8, borderRadius: 10, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  thumb: { width: 56, height: 56 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
});
