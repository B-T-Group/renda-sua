import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Text } from 'react-native-paper';
import { CatalogBrowseHero } from './CatalogBrowseHero';
import { FoodsMenuHero } from './FoodsMenuHero';
import { ClientHomeOrdersStrip } from '../client/ClientHomeOrdersStrip';
import { CatalogBrowseActiveFilterChips } from './CatalogBrowseActiveFilterChips';
import type { Order } from '../../types/agent';
import type { CatalogFilterState } from '../../types/catalogFilter';
import type { Theme } from '../../theme';
import type { HeroSlideId } from './HeroCarousel/heroSlideConfig';

export interface BrowseCatalogListHeaderProps {
  scrollY: Animated.Value;
  theme: Theme;
  isWideHero: boolean;
  resultsLabel: string;
  total: number;
  homeOrders?: Order[];
  homeOrdersTotalActive?: number;
  onOpenHomeOrder?: (order: Order) => void;
  onSeeAllHomeOrders?: () => void;
  nearbyAgentsCount?: number;
  onHeroSlidePress?: (slideId: HeroSlideId) => void;
  /** Optional contextual FTUE nudge rendered under the hero. */
  nudgeSlot?: React.ReactNode;
  catalogFilters: CatalogFilterState;
  onClearFilterField: (field: keyof CatalogFilterState) => void;
  onClearAllFilters: () => void;
  onOpenFilterSheet: () => void;
  activeFilterCount: number;
  sortSummaryLabel: string;
  error: string | null;
  itemsLength: number;
  onListRefresh: () => void;
  foodOnly?: boolean;
}

export const BrowseCatalogListHeader = memo(function BrowseCatalogListHeader({
  scrollY,
  theme,
  isWideHero,
  resultsLabel,
  total,
  homeOrders,
  homeOrdersTotalActive = 0,
  onOpenHomeOrder,
  onSeeAllHomeOrders,
  nearbyAgentsCount = 0,
  onHeroSlidePress,
  nudgeSlot,
  catalogFilters,
  onClearFilterField,
  onClearAllFilters,
  onOpenFilterSheet,
  activeFilterCount,
  sortSummaryLabel,
  error,
  itemsLength,
  onListRefresh,
  foodOnly = false,
}: BrowseCatalogListHeaderProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = theme;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      {foodOnly ? (
        <View style={{ marginBottom: spacing.sm }}>
          <FoodsMenuHero />
          {resultsLabel ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
              {resultsLabel}
            </Text>
          ) : null}
          {homeOrders && homeOrders.length > 0 && onOpenHomeOrder ? (
            <ClientHomeOrdersStrip
              orders={homeOrders}
              totalActive={homeOrdersTotalActive}
              onOpenOrder={onOpenHomeOrder}
              onSeeAll={onSeeAllHomeOrders}
            />
          ) : null}
        </View>
      ) : (
        <CatalogBrowseHero
          scrollY={scrollY}
          theme={theme}
          isWideHero={isWideHero}
          resultsLabel={resultsLabel}
          total={total}
          homeOrders={homeOrders}
          homeOrdersTotalActive={homeOrdersTotalActive}
          onOpenHomeOrder={onOpenHomeOrder}
          onSeeAllHomeOrders={onSeeAllHomeOrders}
          nearbyAgentsCount={nearbyAgentsCount}
          onHeroSlidePress={onHeroSlidePress}
        />
      )}

      {nudgeSlot ? (
        <View style={{ marginTop: spacing.md }}>{nudgeSlot}</View>
      ) : null}

      <View style={[styles.toolbar, { marginTop: spacing.md }]}>
        {/* Filters — filled primary when active, outlined when empty */}
        <Button
          mode={activeFilterCount > 0 ? 'contained' : 'outlined'}
          icon="tune-variant"
          onPress={onOpenFilterSheet}
          buttonColor={activeFilterCount > 0 ? colors.primary.main : undefined}
          textColor={activeFilterCount > 0 ? colors.primary.contrast : undefined}
          contentStyle={styles.filterBtnContent}
        >
          {activeFilterCount > 0
            ? `${t('public.items.filters.heading', 'Filters')} (${activeFilterCount})`
            : t('public.items.filters.heading', 'Filters')}
        </Button>
        {/* Sort — visually separate from the filter control */}
        <Chip
          icon="sort-variant"
          mode="outlined"
          onPress={onOpenFilterSheet}
          style={styles.sortChip}
          elevated
        >
          {sortSummaryLabel}
        </Chip>
      </View>

      <CatalogBrowseActiveFilterChips
        values={catalogFilters}
        onClearField={onClearFilterField}
        onClearAll={onClearAllFilters}
      />

      <Text
        style={[
          typography.subtitle1,
          { color: colors.text.primary, marginTop: spacing.md, marginBottom: spacing.sm },
        ]}
      >
        {foodOnly
          ? t('foods.catalogTitle', 'Available dishes')
          : t('public.items.catalogTitle', 'Available items')}
      </Text>

      {error && itemsLength === 0 ? (
        <View style={[styles.errorBox, { borderColor: colors.error.light }]}>
          <Text style={[typography.body2, { color: colors.error.main }]}>{error}</Text>
          <Chip icon="refresh" onPress={onListRefresh} style={{ marginTop: spacing.sm }}>
            {t('common.retry', 'Retry')}
          </Chip>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  filterBtnContent: {
    height: 36,
  },
  sortChip: {
    alignSelf: 'center',
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
});
