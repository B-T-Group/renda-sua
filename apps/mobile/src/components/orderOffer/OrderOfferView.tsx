import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { OrderOfferUiState } from '../../stores/OrderOfferStore';
import type { OrderOfferDetails } from '../../types/orderOffer';
import { StatusPill } from '../common/StatusPill';

interface OrderOfferViewProps {
  uiState: OrderOfferUiState;
  details: OrderOfferDetails | null;
  message: string | null;
  secondsLeft: number;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  onGoToAvailable: () => void;
}

function formatRegion(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(', ');
}

export function OrderOfferView({
  uiState,
  details,
  message,
  secondsLeft,
  onAccept,
  onDecline,
  onClose,
  onGoToAvailable,
}: OrderOfferViewProps) {
  const { colors, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const isActive = uiState === 'active' || uiState === 'accepting';

  if (uiState === 'loading') {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('agent.orderOffer.loading', 'Loading delivery offer...')}
        </Text>
      </View>
    );
  }

  if (!isActive) {
    const isFunds = uiState === 'insufficientFunds';
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: colors.pageBackground,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={isFunds ? 'wallet-outline' : 'information-outline'}
          size={56}
          color={isFunds ? colors.warning.main : colors.text.secondary}
        />
        <Text
          style={[
            styles.terminalTitle,
            { color: colors.text.primary, marginTop: spacing.md },
          ]}
        >
          {isFunds
            ? t('agent.orderOffer.insufficientFundsTitle', 'Top up needed')
            : t('agent.orderOffer.unavailableTitle', 'Offer closed')}
        </Text>
        {message ? (
          <Text
            style={[
              styles.terminalMessage,
              { color: colors.text.secondary, marginTop: spacing.sm },
            ]}
          >
            {message}
          </Text>
        ) : null}
        <View style={[styles.terminalActions, { marginTop: spacing.xl }]}>
          {isFunds ? (
            <Button
              mode="contained"
              onPress={onGoToAvailable}
              style={styles.fullButton}
            >
              {t('agent.orderOffer.goToAvailable', 'Go to available orders')}
            </Button>
          ) : null}
          <Button mode="outlined" onPress={onClose} style={styles.fullButton}>
            {t('common.close', 'Close')}
          </Button>
        </View>
      </View>
    );
  }

  const distanceText =
    details?.distanceKm != null
      ? `${details.distanceKm.toFixed(1)} ${t('agent.orderOffer.km', 'km')}`
      : '—';
  const earningsText =
    details?.estimatedEarnings != null
      ? `${Math.round(details.estimatedEarnings)} ${details.currency ?? ''}`.trim()
      : '—';
  const etaText =
    details?.estimatedDeliveryMinutes != null
      ? `${details.estimatedDeliveryMinutes} ${t('agent.orderOffer.min', 'min')}`
      : '—';

  const countdownColor =
    secondsLeft <= 10 ? colors.error.main : colors.primary.main;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons
            name="bike-fast"
            size={26}
            color={colors.primary.main}
          />
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {t('agent.orderOffer.title', 'New Delivery')}
          </Text>
        </View>
        <StatusPill
          label={`${secondsLeft}s`}
          icon="timer-outline"
          backgroundColor={countdownColor}
          textColor={colors.primary.contrast}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              marginTop: spacing.lg,
            },
          ]}
        >
          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="store-outline"
              size={22}
              color={colors.success.main}
            />
            <View style={styles.locationText}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>
                {t('agent.orderOffer.pickup', 'Pickup')}
              </Text>
              <Text
                style={[styles.value, { color: colors.text.primary }]}
                numberOfLines={2}
              >
                {details?.pickup.businessName ??
                  t('agent.orderOffer.aStore', 'A store')}
              </Text>
              {formatRegion(details?.pickup.city ?? null, details?.pickup.state ?? null) ? (
                <Text
                  style={[styles.subValue, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {formatRegion(
                    details?.pickup.city ?? null,
                    details?.pickup.state ?? null
                  )}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.divider }]}
          />

          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={22}
              color={colors.error.main}
            />
            <View style={styles.locationText}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>
                {t('agent.orderOffer.dropoff', 'Drop-off area')}
              </Text>
              <Text
                style={[styles.value, { color: colors.text.primary }]}
                numberOfLines={1}
              >
                {formatRegion(
                  details?.dropoff.city ?? null,
                  details?.dropoff.state ?? null
                ) || t('agent.orderOffer.dropoffHidden', 'Shown after accept')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.metricsRow, { marginTop: spacing.lg }]}>
          <Metric
            icon="map-marker-distance"
            label={t('agent.orderOffer.distance', 'Distance')}
            value={distanceText}
          />
          <Metric
            icon="cash"
            label={t('agent.orderOffer.earnings', 'Est. earnings')}
            value={earningsText}
            highlight
          />
          <Metric
            icon="clock-outline"
            label={t('agent.orderOffer.eta', 'Est. time')}
            value={etaText}
          />
        </View>
      </ScrollView>

      <Text
        style={[
          styles.acceptHint,
          { color: colors.text.secondary, marginBottom: spacing.sm },
        ]}
      >
        {t(
          'agent.orderOffer.acceptHint',
          'Only accept if you can pick up right now and head straight to the store.'
        )}
      </Text>

      <View style={[styles.actions, { gap: spacing.md }]}>
        <Button
          mode="outlined"
          onPress={onDecline}
          disabled={uiState === 'accepting'}
          style={styles.actionButton}
          textColor={colors.error.main}
        >
          {t('agent.orderOffer.decline', 'Decline')}
        </Button>
        <Button
          mode="contained"
          onPress={onAccept}
          loading={uiState === 'accepting'}
          disabled={uiState === 'accepting'}
          style={styles.actionButton}
        >
          {t('agent.orderOffer.accept', 'Accept')}
        </Button>
      </View>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={highlight ? colors.success.main : colors.text.secondary}
      />
      <Text
        style={[
          styles.metricValue,
          { color: highlight ? colors.success.main : colors.text.primary },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={[styles.metricLabel, { color: colors.text.secondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  locationText: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  subValue: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 14 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricLabel: { fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row' },
  actionButton: { flex: 1, borderRadius: 12 },
  acceptHint: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  terminalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  terminalMessage: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  terminalActions: { width: '100%', gap: 12 },
  fullButton: { borderRadius: 12 },
});
