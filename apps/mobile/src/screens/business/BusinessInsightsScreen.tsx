import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { BusinessAvailabilityCard } from '../../components/business/BusinessAvailabilityCard';
import { BusinessOrderTimingCard } from '../../components/business/BusinessOrderTimingCard';
import { BusinessExcitementStats } from '../../components/business/BusinessExcitementStats';
import { BusinessTopViewedProducts } from '../../components/business/BusinessTopViewedProducts';
import { useBusinessInsightsScreen } from '../../hooks/business/useBusinessInsightsScreen';

export default function BusinessInsightsScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    loading,
    refreshing,
    error,
    uniqueClientCount,
    totalProductViews,
    productViewsLast7d,
    topViewedProducts,
    onOpenClientCities,
    onOpenTopViewedProduct,
    onRefresh,
    retry,
  } = useBusinessInsightsScreen();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + 32,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          colors={[colors.primary.main]}
          tintColor={colors.primary.main}
        />
      }
    >
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'business.insights.subtitle',
          'Store availability, reliability, and how customers discover your catalog.'
        )}
      </Text>

      <View style={{ marginBottom: spacing.md }}>
        <BusinessAvailabilityCard />
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <BusinessOrderTimingCard />
      </View>

      <Text
        style={[
          typography.overline,
          styles.sectionLabel,
          { color: colors.text.secondary },
        ]}
      >
        {t('business.insights.sections.performance', 'Performance')}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.error.main, marginBottom: 12 }}>{error}</Text>
          <Button mode="contained" onPress={() => void retry()}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {loading && !refreshing && uniqueClientCount == null && !error ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary.main} />
      ) : null}

      <BusinessExcitementStats
        clientCount={uniqueClientCount}
        productViews={totalProductViews}
        productViewsLast7d={productViewsLast7d}
        loading={loading && uniqueClientCount == null && totalProductViews == null}
        onClientsPress={onOpenClientCities}
      />

      <BusinessTopViewedProducts
        products={topViewedProducts}
        loading={loading && uniqueClientCount == null}
        onProductPress={onOpenTopViewedProduct}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: 12, letterSpacing: 1 },
  errorBox: { marginBottom: 16 },
});
