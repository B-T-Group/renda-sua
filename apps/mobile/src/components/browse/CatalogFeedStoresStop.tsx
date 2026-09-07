import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogStore } from '../../types/stores';
import { CatalogStoresRow } from './CatalogStoresRow';

export interface CatalogFeedStoresStopProps {
  stores: CatalogStore[];
  onStorePress?: (businessLocationId: string) => void;
  onSeeAllStores?: () => void;
}

/**
 * "Featured store" mid-feed stop.
 * Reuses the existing CatalogStoresRow (already has header icon).
 */
export const CatalogFeedStoresStop = memo(function CatalogFeedStoresStop({
  stores,
  onStorePress,
  onSeeAllStores,
}: CatalogFeedStoresStopProps) {
  const theme = useTheme();

  if (stores.length === 0) return null;

  return (
    <CatalogStoresRow
      theme={theme}
      stores={stores}
      loading={false}
      onStorePress={onStorePress ?? (() => {})}
      onSeeAllStores={onSeeAllStores}
    />
  );
});

const styles = StyleSheet.create({});
