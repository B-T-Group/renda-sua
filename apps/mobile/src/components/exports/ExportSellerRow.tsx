import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ExportSeller } from '../../types/stores';
import { EXPORT_BRAND_BLUE } from './ExportOnlyBadge';
import { ExportSellerAvatar } from './ExportSellerAvatar';
import { ExportSellerPlace } from './ExportSellerPlace';

/** One row of the all-sellers list: avatar, two-line name, place, count, chevron. */
export function ExportSellerRow({
  seller,
  onPress,
}: {
  seller: ExportSeller;
  onPress: (seller: ExportSeller) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      testID={`export-seller-row-${seller.business_location_id}`}
      accessibilityRole="button"
      accessibilityLabel={t('exportSellers.openSeller', 'Open {{name}}', { name: seller.name })}
      onPress={() => onPress(seller)}
      style={[styles.row, { borderBottomColor: colors.divider, paddingHorizontal: spacing.md }]}
    >
      <ExportSellerAvatar name={seller.name} logoUrl={seller.logo_url} size={48} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={2} style={{ color: colors.text.primary, fontWeight: '700', fontSize: 15 }}>
          {seller.name}
        </Text>
        <ExportSellerPlace country={seller.country} city={seller.city} />
      </View>
      <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 13 }}>
        {t('exportSellers.itemsCount', '{{count}} items', { count: seller.item_count })}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={EXPORT_BRAND_BLUE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
