import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useExportSellers } from '../../hooks/useExportSellers';
import { EXPORT_BRAND_BLUE } from '../../components/exports/ExportOnlyBadge';
import { ExportSellerRow } from '../../components/exports/ExportSellerRow';
import type { ExportSeller } from '../../types/stores';
import type { ExportSellersParams } from '../../navigation/types';
import { exportCountryPlace } from '../../utils/exportCountries';
import type { ExportSellersContext } from '../../utils/exportSellers';
import { trackExportSellerEvent } from '../../utils/exportSellersAnalytics';

type Nav = {
  navigate: (name: string, params: object) => void;
  setOptions: (options: object) => void;
};

export interface ExportSellersScreenProps {
  navigation: Nav;
  route: { params: ExportSellersParams };
}

/** Context line: "From Canada · 12 sellers" / "Depuis le Canada · 12 vendeurs". */
export function useExportContextLabel(ctx: ExportSellersContext): string {
  const { t, i18n } = useTranslation();
  const code = ctx.direction === 'from' ? ctx.originCode : ctx.marketCode;
  if (!code) return '';
  const place = exportCountryPlace(code, i18n.language);
  return ctx.direction === 'from'
    ? t('exportsOrigin.from', 'From {{place}}', { place })
    : t('exportsOrigin.into', 'Into {{place}}', { place });
}

/**
 * All sellers in the current Exports Into / From context, searchable by location or
 * business name. Tapping a row opens the export-only seller page.
 */
export default function ExportSellersScreen({ navigation, route }: ExportSellersScreenProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
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

  const { sellers, total, loading, loadingMore, error, loadMore, refetch } = useExportSellers({
    ...ctx,
    search,
    limit: 30,
  });
  const contextLabel = useExportContextLabel(ctx);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('exportSellers.allTitle', 'All sellers') });
  }, [navigation, t]);

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackExportSellerEvent('exports_sellers_list_viewed', ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (search) trackExportSellerEvent('exports_sellers_search_submitted', ctx, { query_len: search.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openSeller = useCallback(
    (seller: ExportSeller) => {
      navigation.navigate('ExportSeller', {
        ...ctx,
        businessLocationId: seller.business_location_id,
        name: seller.name,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, ctx.direction, ctx.marketCode, ctx.originCode]
  );

  const header = (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm }}>
      {contextLabel ? (
        <View style={styles.contextRow}>
          <MaterialCommunityIcons
            name={ctx.direction === 'from' ? 'airplane-takeoff' : 'airplane-landing'}
            size={16}
            color={colors.text.secondary}
          />
          <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '600' }]}>
            {loading
              ? contextLabel
              : `${contextLabel} · ${t('exportSellers.sellersCount', '{{count}} sellers', { count: total })}`}
          </Text>
        </View>
      ) : null}
      <Searchbar
        testID="export-sellers-search"
        icon="magnify"
        placeholder={t('exportSellers.searchPlaceholder', 'Search sellers')}
        value={draft}
        onChangeText={setDraft}
        autoCorrect={false}
        style={{ backgroundColor: colors.pageBackground, elevation: 0 }}
      />
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={EXPORT_BRAND_BLUE} style={{ marginTop: spacing.lg }} />
  ) : error ? (
    <ExportSellersEmpty
      title={t('exportSellers.loadError', 'We couldn’t load sellers. Try again.')}
      onPress={refetch}
    />
  ) : search ? (
    <ExportSellersEmpty
      title={t('exportSellers.noMatchTitle', 'No sellers match your search')}
      body={t('exportSellers.noMatchHint', 'Try another seller name.')}
    />
  ) : (
    <ExportSellersEmpty title={t('exportSellers.noSellers', 'No sellers in this view yet.')} />
  );

  return (
    <FlatList
      testID="export-sellers-list"
      style={{ flex: 1, backgroundColor: colors.surface }}
      data={sellers}
      keyExtractor={(s) => s.business_location_id}
      renderItem={({ item }) => <ExportSellerRow seller={item} onPress={openSeller} />}
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

export function ExportSellersEmpty({
  title,
  body,
  onPress,
}: {
  title: string;
  body?: string;
  onPress?: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View testID="export-sellers-empty" style={[styles.empty, { padding: spacing.lg }]}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons
          name={onPress ? 'refresh' : 'magnify'}
          size={22}
          color={EXPORT_BRAND_BLUE}
          onPress={onPress}
        />
      </View>
      <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
        {title}
      </Text>
      {body ? <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: 8, marginTop: 24 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
