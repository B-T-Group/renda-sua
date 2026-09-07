import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogFeedStop as FeedStop } from '../../types/catalogFeed';
import { CatalogFeedGoesWithBagStop } from './CatalogFeedGoesWithBagStop';
import { CatalogFeedTopInCategoryStop } from './CatalogFeedTopInCategoryStop';
import { CatalogFeedDealsStop } from './CatalogFeedDealsStop';
import { CatalogFeedCollectionsStop } from './CatalogFeedCollectionsStop';
import { CatalogFeedStoresStop } from './CatalogFeedStoresStop';

export interface CatalogFeedStopProps {
  stop: FeedStop;
  onItemPress?: (inventoryItemId: string) => void;
  onCollectionPress?: (slug: string) => void;
  onStorePress?: (businessLocationId: string) => void;
  onSeeAllDeals?: () => void;
  onSeeAllStores?: () => void;
}

/**
 * Renders a mid-feed "stop" — a horizontal rail or spotlight card
 * that interrupts the 2-column product grid.
 */
export const CatalogFeedStop = memo(function CatalogFeedStop({
  stop,
  onItemPress,
  onCollectionPress,
  onStorePress,
  onSeeAllDeals,
  onSeeAllStores,
}: CatalogFeedStopProps) {
  const { spacing } = useTheme();

  const renderStop = () => {
    switch (stop.stopType) {
      case 'goes-with-bag':
        return (
          <CatalogFeedGoesWithBagStop
            items={stop.data.items ?? []}
            onItemPress={onItemPress}
          />
        );

      case 'top-in-category':
        return (
          <CatalogFeedTopInCategoryStop
            items={stop.data.items ?? []}
            category={stop.data.category ?? ''}
            onItemPress={onItemPress}
          />
        );

      case 'deals':
        return (
          <CatalogFeedDealsStop
            items={stop.data.items ?? []}
            onItemPress={onItemPress}
            onSeeAllDeals={onSeeAllDeals}
          />
        );

      case 'collections':
        return (
          <CatalogFeedCollectionsStop
            collections={stop.data.collections ?? []}
            onCollectionPress={onCollectionPress}
          />
        );

      case 'stores':
        return (
          <CatalogFeedStoresStop
            stores={stop.data.stores ?? []}
            onStorePress={onStorePress}
            onSeeAllStores={onSeeAllStores}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.stopContainer, { marginVertical: spacing.md }]}>
      {renderStop()}
    </View>
  );
});

const styles = StyleSheet.create({
  stopContainer: {
    width: '100%',
  },
});
