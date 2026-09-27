import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { businessApi } from '../../services/businessApi';
import type { FailedPickup } from '../../types/business/failedPickups';

export default function BusinessFailedPickupsListScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [items, setItems] = useState<FailedPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFr = i18n.language?.startsWith('fr');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.failedPickups.list();
      if (res.success) setItems(res.failed_pickups ?? []);
      else {
        setError(
          t(
            'business.failedPickups.loadError',
            'Unable to load failed pickups.'
          )
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              'business.failedPickups.loadError',
              'Unable to load failed pickups.'
            )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary.main} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              colors={[colors.primary.main]}
              tintColor={colors.primary.main}
            />
          }
          contentContainerStyle={[styles.list, { padding: spacing.md }]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {error ? (
                <>
                  <Text style={{ textAlign: 'center', color: colors.error.main }}>
                    {error}
                  </Text>
                  <Button
                    mode="contained-tonal"
                    icon="refresh"
                    style={styles.emptyBtn}
                    onPress={() => void load()}
                  >
                    {t('common.retry', 'Retry')}
                  </Button>
                </>
              ) : (
                <Text style={{ textAlign: 'center', color: colors.text.secondary }}>
                  {t('business.failedPickups.empty', 'No failed pickups')}
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const reason = isFr
              ? item.failure_reason?.reason_fr
              : item.failure_reason?.reason_en;
            const clientName = [
              item.order?.client?.user?.first_name,
              item.order?.client?.user?.last_name,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderRadius: 8,
                  },
                ]}
              >
                <Text variant="titleSmall">
                  {item.order?.order_number ?? item.order_id}
                </Text>
                {clientName ? (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {clientName}
                  </Text>
                ) : null}
                <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                  {reason ?? item.failure_reason?.reason_key}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {t(
                    'business.failedPickups.refundSummary',
                    'Refund {{refund}} {{currency}} (fee {{fee}})',
                    {
                      refund: item.refund_amount,
                      fee: item.fee_retained,
                      currency: item.currency,
                    }
                  )}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flexGrow: 1 },
  emptyWrap: { paddingTop: 48, alignItems: 'center', gap: 12 },
  emptyBtn: { marginTop: 8 },
  row: {},
});
