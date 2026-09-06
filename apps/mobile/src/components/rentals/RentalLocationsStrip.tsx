import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { TopRentalLocationRow } from '../../types/rentals';

function formatDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export interface RentalLocationsStripProps {
  locations: TopRentalLocationRow[];
  loading?: boolean;
  selectedLocationId?: string;
  onSelectLocation: (locationId: string) => void;
}

export function RentalLocationsStrip({
  locations,
  loading,
  selectedLocationId,
  onSelectLocation,
}: RentalLocationsStripProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  if (loading && locations.length === 0) {
    return (
      <View style={{ paddingVertical: spacing.sm, alignItems: 'flex-start' }}>
        <ActivityIndicator size="small" color={colors.primary.main} />
      </View>
    );
  }

  if (locations.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text
        variant="labelLarge"
        style={{ color: colors.text.primary, marginBottom: spacing.xs }}
      >
        {t('rentals.catalog.nearYouTitle', 'Rentals near you')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
      >
        {locations.map((loc) => {
          const selected = loc.id === selectedLocationId;
          const distance = formatDistance(loc.distance_meters);
          const subtitle = [loc.city ?? loc.state, distance ? `~${distance}` : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <Pressable
              key={loc.id}
              onPress={() => onSelectLocation(loc.id)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.pill,
                {
                  borderColor: selected ? colors.primary.main : colors.divider,
                  backgroundColor: pressed
                    ? colors.pageBackground
                    : colors.surface,
                  borderRadius: borderRadius.lg,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  minWidth: 140,
                },
              ]}
            >
              <Text
                variant="labelMedium"
                numberOfLines={1}
                style={{ color: colors.text.primary, fontWeight: '600' }}
              >
                {loc.name}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{ color: colors.text.secondary, marginTop: 2 }}
              >
                {subtitle ||
                  t('rentals.catalog.locationListingCount', '{{count}} listings', {
                    count: loc.listing_count,
                  })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
