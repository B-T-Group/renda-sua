import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import { respondWithinAmber, respondWithinHours } from '../../utils/rentals/dashboardRentalRequests';
import { rentalCategoryIcon } from '../../utils/rentals/rentalCategoryIcon';
import { buildRequestCardModel, type RequestCardModel } from '../../utils/rentals/rentalRequestCardModel';

export function DashboardRentalRequestCard({
  request,
  width,
  showActions = true,
  onAccept,
  onDecline,
  onOpen,
}: {
  request: BusinessRentalRequestRow;
  width?: number;
  showActions?: boolean;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
  onOpen?: (request: BusinessRentalRequestRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [open, setOpen] = useState(false);
  const model = buildRequestCardModel(request, i18n.language, new Date(), t);
  const hours = request.respond_by ? respondWithinHours(request.respond_by) : 0;
  const amber = Boolean(request.respond_by && respondWithinAmber(request.respond_by));
  return (
    <View
      style={[
        styles.card,
        {
          width,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          padding: spacing.sm,
          borderRadius: borderRadius.card,
        },
      ]}
    >
      <Pressable
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={t('rentals.requestCard.openRequest', 'Open request')}
        onPress={onOpen ? () => onOpen(request) : undefined}
      >
        <View style={styles.row}>
          <ItemThumb request={request} />
          <CardCopy model={model} hours={hours} amber={amber} open={open} onToggle={() => setOpen((value) => !value)} />
        </View>
      </Pressable>
      {showActions ? <CardActions request={request} disabled={model.acceptDisabled} onAccept={onAccept} onDecline={onDecline} /> : null}
    </View>
  );
}

function ItemThumb({ request }: { request: BusinessRentalRequestRow }) {
  const { colors, borderRadius } = useTheme();
  const [failed, setFailed] = useState(false);
  const photo = request.rental_location_listing.rental_item.rental_item_images?.[0];
  const uri = photo?.display_url || photo?.thumbnail || photo?.image_url;
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.photo, { borderRadius: borderRadius.icon }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  const name = request.rental_location_listing.rental_item.rental_category?.name
    || request.rental_location_listing.rental_item.name;
  return (
    <View style={[styles.photo, styles.thumb, { backgroundColor: colors.primary.main + '14', borderRadius: borderRadius.icon }]}>
      <MaterialCommunityIcons name={rentalCategoryIcon(name)} size={28} color={colors.primary.main} />
    </View>
  );
}

function CardCopy({
  model,
  hours,
  amber,
  open,
  onToggle,
}: {
  model: RequestCardModel;
  hours: number;
  amber: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const title = model.quantity ? `${model.itemName} × ${model.quantity}` : model.itemName;
  return (
    <View style={styles.body}>
      <View style={styles.metaRow}>
        {model.expired ? (
          <ExpiredChip />
        ) : (
          <>
            <Text variant="labelSmall" style={styles.metaChip}>
              {t('business.dashboard.rentalRequests.requested', 'Requested')}
            </Text>
            <StartChip model={model} />
            {model.updated ? <UpdatedChip /> : null}
          </>
        )}
      </View>
      {model.acceptDisabled ? (
        <Text variant="labelSmall" style={{ color: colors.warning.dark }} numberOfLines={2}>
          {t('rentals.requestCard.alreadyBooked', 'These dates are already booked')}
        </Text>
      ) : null}
      <Text variant="titleSmall" numberOfLines={2}>{title}</Text>
      {model.renterName ? <Text variant="bodySmall" numberOfLines={1}>{model.renterName}</Text> : null}
      {model.place ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }} numberOfLines={1}>
          {model.place}
        </Text>
      ) : null}
      <ScheduleLine model={model} open={open} onToggle={onToggle} />
      {model.receiveLine ? (
        <Text
          variant="titleSmall"
          numberOfLines={1}
          style={model.expired ? { color: colors.text.secondary } : undefined}
        >
          {model.receiveLine}
        </Text>
      ) : null}
      {model.breakdown ? (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={model.expired ? { color: colors.text.secondary } : undefined}
        >
          {model.breakdown}
        </Text>
      ) : null}
      {model.depositAmount ? (
        <Text variant="labelSmall" numberOfLines={1}>
          {t('rentals.requestCard.deposit', 'Deposit {{amount}}', { amount: model.depositAmount })}
        </Text>
      ) : null}
      {model.changeDetail ? (
        <Text variant="labelSmall" numberOfLines={2}>
          {t('rentals.modify.changed', 'Changed: {{detail}}', { detail: model.changeDetail })}
        </Text>
      ) : null}
      {hours > 0 ? (
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: amber ? colors.warning.dark : colors.text.secondary, fontWeight: amber ? '700' : '500' }}
        >
          {t('business.dashboard.rentalRequests.respondWithin', 'Respond within {{hours}}h', { hours })}
        </Text>
      ) : null}
      {model.sentClock ? (
        <Text variant="labelSmall" style={{ color: colors.text.secondary }} numberOfLines={1}>
          {t('rentals.requestCard.sent', 'Sent {{time}}', { time: model.sentClock })}
        </Text>
      ) : null}
    </View>
  );
}

function ExpiredChip() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View testID="rental-request-expired-chip" style={[styles.updated, { backgroundColor: colors.surfaceInput }]}>
      <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '700' }}>
        {t('rentals.requestCard.expired', 'Expired')}
      </Text>
    </View>
  );
}

function UpdatedChip() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.updated, { backgroundColor: colors.infoTint }]}>
      <Text style={{ color: colors.info.dark, fontSize: 11, fontWeight: '700' }}>
        {t('business.dashboard.rentalRequests.updated', 'Updated')}
      </Text>
    </View>
  );
}

function StartChip({ model }: { model: RequestCardModel }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (model.startsIn?.kind === 'today') {
    return (
      <Text variant="labelSmall" style={{ color: colors.warning.dark }}>
        {t('rentals.requestCard.startsToday', 'Starts today')}
      </Text>
    );
  }
  if (model.startsIn?.kind === 'days') {
    return (
      <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
        {t('rentals.requestCard.startsIn', 'Starts in {{count}} day', {
          count: model.startsIn.count,
          defaultValue_plural: 'Starts in {{count}} days',
        })}
      </Text>
    );
  }
  return null;
}

function ScheduleLine({ model, open, onToggle }: { model: RequestCardModel; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  if (!model.schedule.summary) return null;
  return (
    <View>
      <Text variant="bodySmall" numberOfLines={1} onPress={model.schedule.expandable ? onToggle : undefined}>
        {open ? t('rentals.requestCard.hideTimes', 'Hide times') : model.schedule.summary}
      </Text>
      {open ? model.schedule.lines.map((line) => <Text key={line} variant="labelSmall">{line}</Text>) : null}
    </View>
  );
}

export function CardActions({
  request,
  disabled,
  onAccept,
  onDecline,
}: {
  request: BusinessRentalRequestRow;
  disabled: boolean;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const acceptLabel = disabled
    ? t('rentals.requestCard.acceptUnavailable', 'Accept unavailable — dates are taken')
    : t('business.dashboard.rentalRequests.accept', 'Accept');
  return (
    <View testID="rental-request-actions" style={styles.actions}>
      <Pressable
        testID="rental-request-decline"
        accessibilityLabel={t('business.dashboard.rentalRequests.decline', 'Decline')}
        onPress={() => onDecline(request)}
        style={[styles.iconBtn, styles.decline, { borderColor: colors.divider }]}
      >
        <MaterialCommunityIcons name="close" color={colors.error.main} size={22} />
      </Pressable>
      <Pressable
        testID="rental-request-accept"
        accessibilityLabel={acceptLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onAccept(request)}
        style={[styles.iconBtn, { backgroundColor: disabled ? colors.divider : colors.success.main }]}
      >
        <MaterialCommunityIcons name="check" color="#fff" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  photo: {
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    flexShrink: 0,
  },
  updated: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingRight: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    borderWidth: 1,
    backgroundColor: '#fff',
  },
});
