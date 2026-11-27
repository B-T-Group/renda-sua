import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Snackbar, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { rentalsApi } from '../../services/rentalsApi';
import { brandFaceStyle } from '../../theme/fonts';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import { compareSoonestRequestStart } from '../../utils/rentals/dashboardRentalRequests';
import { PagedCarousel } from '../common/PagedCarousel';
import { BusinessRentalRespondDialog } from './rentals/BusinessRentalRespondDialog';
import { DashboardRentalRequestCard } from './DashboardRentalRequestCard';

type Notice = { id: string; itemName: string; renterName: string; window: 'sla' | 'start' };

/** Approved 26 Nov 2026 notice accent — softer than warning.light (the old solid amber fill). */
const AMBER_EDGE = '#E8A23A';

export function DashboardRentalRequests() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { flags, loading } = useClientFlags();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
  const [target, setTarget] = useState<{ req: BusinessRentalRequestRow; mode: 'available' | 'unavailable' } | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const enabled = !loading && flags.rentals_dashboard_requests_enabled;

  const load = useCallback(async () => {
    const data = await rentalsApi.getDashboardRequests();
    setRequests([...data.requests].sort(compareSoonestRequestStart));
    setNotices(data.expiryNotices);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load().catch(() => undefined);
  }, [enabled, load]);

  const onSuccess = useCallback(() => {
    if (!target) return;
    const item = target.req.rental_location_listing.rental_item.name;
    setRequests((rows) => rows.filter((row) => row.id !== target.req.id));
    const key = target.mode === 'available' ? 'business.dashboard.rentalRequests.acceptedToast' : 'business.dashboard.rentalRequests.declinedToast';
    const fallback = target.mode === 'available' ? 'Request accepted for {{item}}' : 'Request declined for {{item}}';
    setSnack(t(key, fallback, { item }));
  }, [t, target]);

  const renderCard = useCallback(
    (request: BusinessRentalRequestRow, width: number) => (
      <DashboardRentalRequestCard
        request={request}
        width={width}
        onAccept={(req) => setTarget({ req, mode: 'available' })}
        onDecline={(req) => setTarget({ req, mode: 'unavailable' })}
      />
    ),
    []
  );

  const openStudio = useCallback(() => {
    navigation.navigate('BusinessRentalsStudio', { tab: 'requests' });
  }, [navigation]);

  const currentNotice = notices[0];

  const onDismissNotice = useCallback((id: string) => {
    setNotices((rows) => rows.filter((row) => row.id !== id));
    void rentalsApi.dismissExpiryNotice(id).catch(() => undefined);
  }, []);

  if (!enabled || (requests.length === 0 && notices.length === 0)) return null;

  return (
    <View
      style={{ marginBottom: spacing.md }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - pageWidth) > 1) setPageWidth(next);
      }}
      accessibilityLabel={t('business.dashboard.rentalRequests.sectionA11y', 'Rental requests, {{count}}', { count: requests.length })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text variant="labelLarge">
          {t('business.dashboard.rentalRequests.sectionTitle', 'Rental requests')}
          {requests.length > 0 ? ` ${requests.length}` : ''}
        </Text>
        <Text onPress={openStudio} style={{ color: colors.primary.main }}>
          {t('business.dashboard.rentalRequests.seeAll', 'See all')}
        </Text>
      </View>
      {currentNotice ? (
        <ExpiryNotice
          notice={currentNotice}
          onDismiss={() => onDismissNotice(currentNotice.id)}
          onView={() => navigation.navigate('BusinessRentalRequestDetail', { requestId: currentNotice.id })}
        />
      ) : null}
      {requests.length > 0 ? (
        pageWidth > 0 ? (
          requests.length === 1 ? (
            renderCard(requests[0], pageWidth)
          ) : (
            <PagedCarousel
              data={requests}
              keyExtractor={(item) => item.id}
              pageWidth={pageWidth}
              autoAdvanceMs={null}
              showDots
              accessibilityLabelForIndex={(current, total) =>
                t('business.dashboard.rentalRequests.pageA11y', 'Request {{current}} of {{total}}', {
                  current: current + 1,
                  total,
                })
              }
              renderItem={({ item, width }) => renderCard(item, width)}
            />
          )
        ) : (
          <View style={{ minHeight: 180 }} />
        )
      ) : null}
      <BusinessRentalRespondDialog
        visible={target != null}
        mode={target?.mode ?? null}
        request={target?.req ?? null}
        onDismiss={() => setTarget(null)}
        onSuccess={onSuccess}
      />
      <Snackbar visible={snack != null} onDismiss={() => setSnack(null)} duration={4000}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function ExpiryNotice({
  notice,
  onDismiss,
  onView,
}: {
  notice: Notice;
  onDismiss: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const reason =
    notice.window === 'start'
      ? t(
          'business.dashboard.rentalRequests.expiredStartReason',
          "You didn't reply before the start time. The renter can send a new request."
        )
      : t(
          'business.dashboard.rentalRequests.expiredSlaReason',
          "You didn't reply within 24 hours. The renter can send a new request."
        );
  const who = [notice.itemName, notice.renterName].filter(Boolean).join(' · ');
  return (
    <View
      testID="rental-request-expiry-notice"
      accessibilityRole="summary"
      style={[
        styles.card,
        shadows.sm,
        {
          marginBottom: spacing.sm,
          padding: spacing.md,
          paddingLeft: spacing.md + 4,
          borderRadius: borderRadius.card,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={[styles.edge, { backgroundColor: AMBER_EDGE }]} />
      <View style={styles.header}>
        <View style={[styles.clock, { backgroundColor: colors.warningTint }]}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={AMBER_EDGE} />
        </View>
        <View style={styles.copy}>
          <Text style={[brandFaceStyle('700'), styles.title, { color: colors.text.primary }]}>
            {t('business.dashboard.rentalRequests.expiredTitle', 'Request expired')}
          </Text>
          {who ? (
            <Text style={[brandFaceStyle('600'), typography.bodySmall, { color: colors.text.primary, marginTop: 2 }]}>
              {who}
            </Text>
          ) : null}
          <Text style={[typography.bodySmall, { color: colors.text.secondary, marginTop: 4 }]}>{reason}</Text>
          <Pressable
            testID="rental-request-expiry-view"
            accessibilityRole="button"
            accessibilityLabel={t('business.dashboard.rentalRequests.viewRequest', 'View request')}
            onPress={onView}
            style={[styles.viewBtn, { backgroundColor: colors.primary.main, marginTop: spacing.sm }]}
          >
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary.contrast} />
            <Text style={[brandFaceStyle('600'), styles.viewLabel, { color: colors.primary.contrast }]}>
              {t('business.dashboard.rentalRequests.viewRequest', 'View request')}
            </Text>
          </Pressable>
        </View>
        <Pressable
          testID="rental-request-expiry-dismiss"
          accessibilityRole="button"
          accessibilityLabel={t('business.dashboard.rentalRequests.dismissNotice', 'Dismiss')}
          onPress={onDismiss}
          hitSlop={8}
          style={[styles.dismiss, { backgroundColor: colors.surfaceInput }]}
        >
          <MaterialCommunityIcons name="close" size={16} color={colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  clock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  viewBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 36,
  },
  viewLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
