import React, { memo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { InventoryCatalogGridTile } from './InventoryCatalogGridTile';
import type {
  DiscoveryRecovery,
  RecoveryFilterName,
} from '@/types/inventoryCatalog';

export interface DiscoveryRecoveryLadderProps {
  recovery: DiscoveryRecovery;
  onSearchCorrected: (query: string) => void;
  onSearchOriginal: (query: string) => void;
  onRemoveFilter: (filter: RecoveryFilterName) => void;
  onBrowseCategory: (categoryName: string) => void;
  onItemPress?: (inventoryItemId: string) => void;
  onAskRenda?: (query: string) => void;
}

export const DiscoveryRecoveryLadder = memo(function DiscoveryRecoveryLadder({
  recovery,
  onSearchCorrected,
  onSearchOriginal,
  onRemoveFilter,
  onBrowseCategory,
  onItemPress,
  onAskRenda,
}: DiscoveryRecoveryLadderProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();

  const getFilterLabel = useCallback(
    (filter: RecoveryFilterName): string => {
      switch (filter) {
        case 'category':
          return t('public.items.filters.category', 'Category');
        case 'subcategory':
          return t('public.items.filters.subcategory', 'Subcategory');
        case 'brand':
          return t('public.items.filters.brand', 'Brand');
        case 'min_price':
          return t('checkout.minPrice', 'Min price');
        case 'max_price':
          return t('checkout.maxPrice', 'Max price');
        case 'location_name':
          return t('public.items.filters.location', 'Location');
        case 'business_name':
          return t('public.items.filters.business', 'Business');
        case 'currency':
          return t('common.currency', 'Currency');
      }
    },
    [t]
  );

  const handleItemPress = useCallback(
    (id: string) => {
      onItemPress?.(id);
    },
    [onItemPress]
  );

  // R1: Auto-corrected query
  const showR1 = recovery.corrected_query && recovery.corrected_total > 0;

  // R2: Removable filters
  const showR2 = recovery.relax.length > 0;

  // R3: Similar items
  const showR3 = recovery.similar.length > 0;

  // R4: Categories + Popular near you (guaranteed floor)
  const showR4 = recovery.categories.length > 0 || recovery.popular_near_you.length > 0;

  // R5: Ask Renda
  const showR5 = recovery.ask_renda.enabled && onAskRenda;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text
        variant="headlineSmall"
        style={[
          typography.headlineSmall,
          { color: colors.text.primary, marginBottom: spacing.xs, textAlign: 'center' },
        ]}
      >
        {t('public.items.discoveryEmptyResult.title', 'Nothing for "{{query}}" yet', {
          query: recovery.query,
        })}
      </Text>
      <Text
        variant="bodyMedium"
        style={[
          typography.body1,
          { color: colors.text.secondary, marginBottom: spacing.lg, textAlign: 'center' },
        ]}
      >
        {t('public.items.discoveryEmptyResult.subtitle', 'Try these instead')}
      </Text>

      {/* R1: Corrected query */}
      {showR1 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={[
              typography.body1,
              { color: colors.text.primary, marginBottom: spacing.sm },
            ]}
          >
            {t(
              'public.items.discoveryEmptyResult.corrected',
              'Showing results for **{{corrected}}**',
              { corrected: recovery.corrected_query }
            ).replace(/\*\*([^*]+)\*\*/g, '$1')}
          </Text>
          <Pressable
            onPress={() => onSearchOriginal(recovery.query)}
            style={{ paddingVertical: spacing.xs }}
          >
            <Text style={[typography.body2, { color: colors.primary.main }]}>
              {t(
                'public.items.discoveryEmptyResult.searchInstead',
                'Search instead for "{{original}}"',
                { original: recovery.query }
              )}
            </Text>
          </Pressable>
        </View>
      )}

      {/* R2: Remove filter chips */}
      {showR2 && (
        <View style={{ marginBottom: spacing.md }}>
          <View style={styles.chipRow}>
            {recovery.relax.map((item) => {
              const label = `${getFilterLabel(item.filter)}: ${item.value}`;
              const chipLabel = t(
                'public.items.discoveryEmptyResult.removeFilter',
                'Remove {{filter}} · {{n}}',
                { filter: label, n: item.count }
              );
              return (
                <Chip
                  key={`${item.filter}-${item.value}`}
                  onPress={() => onRemoveFilter(item.filter)}
                  icon="close-circle-outline"
                  mode="outlined"
                  style={[styles.chip, { borderColor: colors.divider }]}
                  textStyle={{ fontSize: 14 }}
                >
                  {chipLabel}
                </Chip>
              );
            })}
          </View>
        </View>
      )}

      {/* R3: Similar items */}
      {showR3 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text
            variant="titleMedium"
            style={[
              typography.titleMedium,
              { color: colors.text.primary, marginBottom: spacing.sm },
            ]}
          >
            {t('public.items.discoveryEmptyResult.similarTitle', 'Similar to "{{query}}"', {
              query: recovery.query,
            })}
          </Text>
          <View style={styles.gridRow}>
            {recovery.similar.slice(0, 4).map((item) => (
              <View key={item.id} style={{ flex: 1, minWidth: '48%', padding: spacing.xs }}>
                <InventoryCatalogGridTile item={item} onPress={handleItemPress} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* R4: Categories + Popular near you */}
      {showR4 && (
        <View style={{ marginBottom: spacing.md }}>
          {recovery.categories.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.chipRow}>
                {recovery.categories.map((cat) => (
                  <Chip
                    key={cat.id ?? cat.name}
                    onPress={() => onBrowseCategory(cat.name)}
                    icon="tag-outline"
                    mode="outlined"
                    style={[styles.chip, { borderColor: colors.divider }]}
                    textStyle={{ fontSize: 14 }}
                  >
                    {t('public.items.discoveryEmptyResult.browseCategory', 'Browse {{category}}', {
                      category: cat.name,
                    })}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {recovery.popular_near_you.length > 0 && (
            <View>
              <Text
                variant="titleMedium"
                style={[
                  typography.titleMedium,
                  { color: colors.text.primary, marginBottom: spacing.sm },
                ]}
              >
                {t('public.items.discoveryEmptyResult.popularNearYou', 'Popular near you')}
              </Text>
              <View style={styles.gridRow}>
                {recovery.popular_near_you.slice(0, 4).map((item) => (
                  <View key={item.id} style={{ flex: 1, minWidth: '48%', padding: spacing.xs }}>
                    <InventoryCatalogGridTile item={item} onPress={handleItemPress} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* R5: Ask Renda */}
      {showR5 && (
        <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <Button
            mode="contained"
            onPress={() => onAskRenda!(recovery.ask_renda.query)}
            icon="chat-question-outline"
            style={{ borderRadius: borderRadius.md }}
          >
            {t('public.items.discoveryEmptyResult.askRenda', 'Ask Renda to find it')}
          </Button>
        </View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 0,
    marginBottom: 0,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
});
