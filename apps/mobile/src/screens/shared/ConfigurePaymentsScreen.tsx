import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStripeConnect } from '../../hooks/useStripeConnect';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { StripeConnectCard } from '../../components/payments/StripeConnectCard';

export default function ConfigurePaymentsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    status,
    loading,
    actionLoading,
    error,
    fetchStatus,
    startOnboarding,
    openDashboard,
  } = useStripeConnect();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetchStatus();
    }, [fetchStatus])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchStatus();
    } finally {
      setRefreshing(false);
    }
  }, [fetchStatus]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
          />
        }
      >
        {error ? (
          <NoticeBanner
            style={styles.banner}
            tone="error"
            message={error}
            actionLabel={t('common.retry', 'Retry')}
            onAction={() => void fetchStatus()}
          />
        ) : null}

        <StripeConnectCard
          status={status}
          loading={loading && !status}
          onboarding={actionLoading}
          onStartOnboarding={() => void startOnboarding()}
          onOpenDashboard={() => void openDashboard()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  banner: { marginBottom: 4 },
});
