import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useExportSellers } from '../../hooks/useExportSellers';
import { useInventoryCatalog } from '../../hooks/useInventoryCatalog';
import { useStore } from '../../stores/RootStore';
import { EXPORT_BRAND_BLUE } from '../../components/exports/ExportOnlyBadge';
import { ExportSellerAvatar } from '../../components/exports/ExportSellerAvatar';
import { ExportSellerPlace } from '../../components/exports/ExportSellerPlace';
import { InventoryCatalogGridTile } from '../../components/browse/InventoryCatalogGridTile';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import type { ExportSellerParams } from '../../navigation/types';
import { exportCountryName } from '../../utils/exportCountries';
import type { ExportSellersContext } from '../../utils/exportSellers';
import { trackExportSellerEvent } from '../../utils/exportSellersAnalytics';
import { ExportSellersEmpty } from './ExportSellersScreen';

type Nav = {
  navigate: (name: string, params: object) => void;
  setOptions: (options: object) => void;
};

export interface ExportSellerScreenProps {
  navigation: Nav;
  route: { params: ExportSellerParams };
}

/**
 * Export-only seller page: one business location's export items in the current
 * Into / From context. Search, dense 2-column tiles (Export only, Price on request),
 * no Buy or Add to cart. Local-sale items at the location are never listed.
 */
export default function ExportSellerScreen({ navigation, route }: ExportSellerScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const { auth } = useStore();
  const { businessLocationId } = route.params;
  const ctx: ExportSellersContext = {
    direction: route.params.direction,
    marketCode: route.params.marketCode ?? null,
    originCode: route.params.originCode ?? null,
  };
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSearch(draft.trim()), 400);
    return () => clearTimeout(id);
  }, [draft]);

  const { sellers, loading: headerLoading } = useExportSellers({
    ...ctx,
    businessLocationId,
    limit: 1,
  });
  const seller = sellers[0];
  const name = seller?.name ?? route.params.name ?? '';

  const { items, loading, loadingMore, loadMore, total } = useInventoryCatalog({
    search,
    sort: 'relevance',
    countryCode: ctx.marketCode ?? undefined,
    business_location_id: businessLocationId,
    export_only: true,
    origin_country: ctx.direction === 'from' ? ctx.originCode ?? undefined : undefined,
    withAuth: auth.isAuthenticated,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || t('exportSellers.title', 'Sellers') });
  }, [navigation, name, t]);

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackExportSellerEvent('exports_seller_page_viewed', ctx, { location_id: businessLocationId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (search) {
      trackExportSellerEvent('exports_seller_page_search_submitted', ctx, {
        location_id: businessLocationId,
        query_len: search.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openItem = useCallback(
    (inventoryItemId: string) => navigation.navigate('InventoryItemDetail', { inventoryItemId }),
    [navigation]
  );

  const count = seller?.item_count ?? (search ? undefined : total);
  const header = (
    <View style={{ paddingHorizontal: spacing.xs, paddingTop: spacing.md, gap: spacing.md }}>
      <View testID="export-seller-header" style={styles.headerRow}>
        <ExportSellerAvatar name={name || '?'} logoUrl={seller?.logo_url} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[typography.h4, { color: colors.text.primary, fontWeight: '800' }]}>
            {name}
          </Text>
          <ExportSellerPlace
            country={seller?.country}
            city={seller?.city}
            trailing={seller?.country ? exportCountryName(seller.country, i18n.language) : null}
          />
          {typeof count === 'number' && !headerLoading ? (
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
              {t('exportSellers.exportItemsCount', '{{count}} export items', { count })}
            </Text>
          ) : null}
        </View>
      </View>
      <Searchbar
        testID="export-seller-search"
        icon="magnify"
        placeholder={t('exportSellers.sellerSearchPlaceholder', 'Search this seller')}
        value={draft}
        onChangeText={setDraft}
        autoCorrect={false}
        style={{ backgroundColor: colors.pageBackground, elevation: 0, marginBottom: spacing.sm }}
      />
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={EXPORT_BRAND_BLUE} style={{ marginTop: spacing.lg }} />
  ) : search ? (
    <ExportSellersEmpty
      title={t('exportSellers.itemsNoMatchTitle', 'No items match your search')}
      body={t('exportSellers.itemsNoMatchHint', 'Try another word.')}
    />
  ) : (
    <ExportSellersEmpty
      title={t('exportSellers.sellerEmpty', 'No export items at this seller in this view.')}
    />
  );

  return (
    <FlatList
      testID="export-seller-items"
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xl }}
      data={items}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.sm }}
      keyExtractor={(row: CatalogInventoryItem) => row.id}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <InventoryCatalogGridTile item={item} onPress={openItem} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color={EXPORT_BRAND_BLUE} style={{ margin: spacing.md }} /> : null
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
