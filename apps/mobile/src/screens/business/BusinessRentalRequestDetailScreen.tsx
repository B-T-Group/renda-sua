import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { CardActions, DashboardRentalRequestCard } from '../../components/business/DashboardRentalRequestCard';
import { RentalRequestExpiredBanner } from '../../components/business/RentalRequestExpiredBanner';
import { BusinessRentalRespondDialog } from '../../components/business/rentals/BusinessRentalRespondDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import { buildRequestCardModel } from '../../utils/rentals/rentalRequestCardModel';
import { expiredRequestWindow, isExpiredRentalRequest } from '../../utils/rentals/dashboardRentalRequests';

type DetailRoute = RouteProp<BusinessRootStackParamList, 'BusinessRentalRequestDetail'>;

export default function BusinessRentalRequestDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();
  const { requestId } = useRoute<DetailRoute>().params;
  const [request, setRequest] = useState<BusinessRentalRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState<'available' | 'unavailable' | null>(null);

  const load = useCallback(async () => {
    const rows = await rentalsApi.getBusinessRequests({ id: requestId });
    setRequest(rows[0] ?? null);
  }, [requestId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: spacing.lg }} />;
  if (!request) {
    return <Text style={{ margin: spacing.md }}>{t('rentals.requestCard.notFound', 'This request is no longer here.')}</Text>;
  }
  const expired = isExpiredRentalRequest(request);
  const canRespond = request.status === 'pending';
  const disabled = buildRequestCardModel(request, i18n.language, new Date(), t).acceptDisabled;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background.default }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: canRespond ? 140 : spacing.md }}>
        {stale ? <Text style={{ color: colors.warning.dark, marginBottom: spacing.sm }}>{t('rentals.modify.staleBanner', 'This request was updated. Review the latest version.')}</Text> : null}
        {expired ? (
          <RentalRequestExpiredBanner window={expiredRequestWindow(request)} style={{ marginBottom: spacing.md }} />
        ) : null}
        <DashboardRentalRequestCard request={request} showActions={false} onAccept={() => undefined} onDecline={() => undefined} />
      </ScrollView>
      {canRespond ? (
        <View style={[styles.footer, { borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.md }]}>
          <Text variant="bodySmall">{t('rentals.requestCard.chargedAfterAccept', 'The renter is charged after you accept')}</Text>
          <CardActions
            request={request}
            disabled={disabled}
            onAccept={() => setMode('available')}
            onDecline={() => setMode('unavailable')}
          />
        </View>
      ) : null}
      <BusinessRentalRespondDialog
        visible={mode != null}
        mode={mode}
        request={request}
        onDismiss={() => setMode(null)}
        onSuccess={() => navigation.goBack()}
        onStale={() => {
          setStale(true);
          void load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1 },
});
