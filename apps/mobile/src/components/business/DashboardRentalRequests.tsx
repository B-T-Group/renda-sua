import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Snackbar, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import { compareSoonestRequestStart } from '../../utils/rentals/dashboardRentalRequests';
import { PagedCarousel } from '../common/PagedCarousel';
import { BusinessRentalRespondDialog } from './rentals/BusinessRentalRespondDialog';
import { DashboardRentalRequestCard } from './DashboardRentalRequestCard';
import { RentalRequestExpiredBanner } from './RentalRequestExpiredBanner';

type Notice = { id: string; itemName: string; renterName: string; window: 'sla' | 'start' };

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
          onDismiss={() => setNotices((rows) => rows.slice(1))}
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
  const { spacing } = useTheme();
  const who = [notice.itemName, notice.renterName].filter(Boolean).join(' · ');
  return (
    <RentalRequestExpiredBanner
      window={notice.window}
      who={who}
      onView={onView}
      onDismiss={onDismiss}
      testID="rental-request-expiry-notice"
      style={{ marginBottom: spacing.sm }}
    />
  );
}
