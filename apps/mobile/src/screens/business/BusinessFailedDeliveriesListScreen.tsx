import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { FailedDeliveryListRow } from '../../components/business/FailedDeliveryListRow';
import { ResolveFailedDeliveryModal } from '../../components/business/ResolveFailedDeliveryModal';
import { businessApi } from '../../services/businessApi';
import type { FailedDelivery } from '../../types/business/failedDeliveries';

export default function BusinessFailedDeliveriesListScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [items, setItems] = useState<FailedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FailedDelivery | null>(null);
  const [successSnack, setSuccessSnack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.failedDeliveries.list('pending');
      if (res.success) setItems(res.failed_deliveries ?? []);
      else {
        setError(
          t(
            'business.failedDeliveries.loadError',
            'Unable to load failed deliveries.'
          )
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              'business.failedDeliveries.loadError',
              'Unable to load failed deliveries.'
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
                  {t(
                    'business.failedDeliveries.empty',
                    'No pending failed deliveries'
                  )}
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <FailedDeliveryListRow item={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      <ResolveFailedDeliveryModal
        visible={!!selected}
        orderId={selected?.order_id ?? null}
        seed={selected}
        onDismiss={() => setSelected(null)}
        onResolved={() => {
          setSuccessSnack(true);
          void load();
        }}
      />

      <Snackbar
        visible={successSnack}
        onDismiss={() => setSuccessSnack(false)}
        duration={3000}
      >
        {t(
          'business.failedDeliveries.resolveSuccess',
          'Failed delivery resolved.'
        )}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 24, flexGrow: 1 },
  emptyWrap: { marginTop: 24, alignItems: 'center', paddingHorizontal: 24 },
  emptyBtn: { marginTop: 16 },
});
