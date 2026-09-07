import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { CityWordCloud } from '../../components/business/CityWordCloud';
import { useBusinessClientCities } from '../../hooks/business/useBusinessClientCities';

export default function BusinessClientCitiesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { cities, totalClientsWithCity, loading, error, refetch } =
    useBusinessClientCities(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
      <Text variant="bodyLarge" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t(
          'business.clientCities.subtitle',
          'A word cloud of cities for people who have ordered or rented from you.'
        )}
      </Text>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginVertical: 48 }} color={colors.primary.main} />
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.error.main, marginBottom: 12 }}>{error}</Text>
          <Button mode="contained" onPress={() => void refetch()}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {!loading && !error ? (
        <>
          {totalClientsWithCity > 0 ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
            >
              {t('business.clientCities.stat', {
                count: totalClientsWithCity,
                defaultValue: '{{count}} clients with a known city',
              })}
            </Text>
          ) : null}
          <CityWordCloud
            cities={cities}
            emptyLabel={t(
              'business.clientCities.empty',
              'No client cities yet. Cities appear as customers order or rent with an address.'
            )}
          />
          {cities.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text
                variant="labelMedium"
                style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
              >
                {t('business.clientCities.legend', 'Cities by client count')}
              </Text>
              <View style={styles.chips}>
                {cities.slice(0, 12).map((city) => (
                  <View
                    key={city.name}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.primaryTint },
                    ]}
                  >
                    <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                      {city.name} · {city.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  errorBox: { marginVertical: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
