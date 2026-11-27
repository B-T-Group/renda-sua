import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ExportSeller } from '../../types/stores';
import { EXPORT_SELLERS_CAROUSEL_MAX } from '../../utils/exportSellers';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';
import { ExportSellerAvatar } from './ExportSellerAvatar';
import { ExportSellerPlace } from './ExportSellerPlace';

export const EXPORT_SELLER_CARD_WIDTH = 140;

export interface ExportSellersCarouselProps {
  sellers: ExportSeller[];
  total: number;
  loading?: boolean;
  onPressSeller: (seller: ExportSeller, position: number) => void;
  onSeeAll: (source: 'header' | 'trailing_card') => void;
  /** Fired once per context when the row is shown with at least one seller. */
  onViewed?: (shown: number, total: number) => void;
}

/**
 * "Sellers" / "Vendeurs" row above the export grid: at most 10 cards (logo or monogram,
 * name, city + country, plural-safe count) and a More card only when total > 10.
 * Hidden entirely when the context has no seller.
 */
export function ExportSellersCarousel({
  sellers,
  total,
  loading,
  onPressSeller,
  onSeeAll,
  onViewed,
}: ExportSellersCarouselProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const shown = sellers.slice(0, EXPORT_SELLERS_CAROUSEL_MAX);
  const viewedKey = useRef<string | null>(null);
  const key = shown.map((s) => s.business_location_id).join(',');
  useEffect(() => {
    if (shown.length === 0 || viewedKey.current === key) return;
    viewedKey.current = key;
    onViewed?.(shown.length, total);
  }, [key, shown.length, total, onViewed]);

  if (loading && sellers.length === 0) {
    return <ActivityIndicator color={EXPORT_BRAND_BLUE} style={{ marginVertical: spacing.sm }} />;
  }
  if (shown.length === 0) return null;
  const hasMore = total > EXPORT_SELLERS_CAROUSEL_MAX;

  return (
    <View testID="export-sellers-carousel" style={{ marginTop: spacing.sm }}>
      <View style={styles.header}>
        <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}>
          {t('exportSellers.title', 'Sellers')}
        </Text>
        {hasMore ? (
          <Pressable
            testID="export-sellers-see-all"
            accessibilityRole="button"
            onPress={() => onSeeAll('header')}
            hitSlop={8}
            style={styles.seeAll}
          >
            <MaterialCommunityIcons name="chevron-right" size={18} color={EXPORT_BRAND_BLUE} />
            <Text style={{ color: EXPORT_BRAND_BLUE, fontWeight: '700', fontSize: 14 }}>
              {t('exportSellers.seeAll', 'See all')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: spacing.md, alignItems: 'stretch' }}
      >
        {shown.map((seller, index) => (
          <Pressable
            key={seller.business_location_id}
            testID={`export-seller-card-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t('exportSellers.openSeller', 'Open {{name}}', { name: seller.name })}
            onPress={() => onPressSeller(seller, index)}
            style={[
              styles.card,
              { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md },
            ]}
          >
            <ExportSellerAvatar name={seller.name} logoUrl={seller.logo_url} />
            <Text numberOfLines={2} style={[styles.name, { color: colors.text.primary }]}>
              {seller.name}
            </Text>
            <View style={{ flex: 1 }} />
            <ExportSellerPlace country={seller.country} city={seller.city} />
            <Text style={[styles.count, { color: colors.text.primary }]}>
              {t('exportSellers.itemsCount', '{{count}} items', { count: seller.item_count })}
            </Text>
          </Pressable>
        ))}
        {hasMore ? (
          <Pressable
            testID="export-sellers-more-card"
            accessibilityRole="button"
            onPress={() => onSeeAll('trailing_card')}
            style={[styles.card, styles.moreCard, { borderRadius: borderRadius.md }]}
          >
            <View style={styles.moreIcon}>
              <MaterialCommunityIcons name="magnify" size={22} color={EXPORT_BRAND_BLUE} />
            </View>
            <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
              {t('exportSellers.more', 'More')}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center' }}>
              {t('exportSellers.allTitle', 'All sellers')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  card: {
    width: EXPORT_SELLER_CARD_WIDTH,
    minHeight: 168,
    marginRight: 10,
    padding: 10,
    borderWidth: 1,
    gap: 6,
  },
  name: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  count: { fontSize: 12, fontWeight: '700' },
  moreCard: {
    backgroundColor: '#EAF1FB',
    borderColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
