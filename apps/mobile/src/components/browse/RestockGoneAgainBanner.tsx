import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import {
  catalogOrderedImages,
  catalogSalePrice,
  formatCatalogMoney,
} from '../../utils/catalogInventoryDisplay';

export interface RestockGoneAgainBannerProps {
  similar: CatalogInventoryItem[];
  onOpenSimilar: (inventoryItemId: string) => void;
}

/**
 * Arriving from a restock alert (`src=restock_alert`) on an item that sold out
 * again: inline banner plus 2-3 similar in-stock items so there is no dead end.
 */
export function RestockGoneAgainBanner({ similar, onOpenSimilar }: RestockGoneAgainBannerProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}>
      <View
        accessibilityRole="alert"
        style={[styles.banner, { backgroundColor: colors.primaryTint, borderRadius: spacing.sm }]}
      >
        <MaterialCommunityIcons name="bell-outline" size={20} color={colors.primary.main} />
        <Text style={[typography.body2, styles.bannerText, { color: colors.text.primary }]}>
          {t('restockAlerts.goneAgain', "Gone again. We'll tell you next time.")}
        </Text>
      </View>
      {similar.length > 0 ? (
        <View style={[styles.similarRow, { gap: spacing.sm, marginTop: spacing.sm }]}>
          {similar.map((s) => {
            const img = catalogOrderedImages(s)[0];
            const imageUrl = img?.display_url?.trim() || img?.image_url;
            return (
              <Pressable
                key={s.id}
                onPress={() => onOpenSimilar(s.id)}
                accessibilityRole="button"
                accessibilityLabel={s.item.name}
                style={[styles.similarCard, { backgroundColor: colors.background.paper }]}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.similarImage} />
                ) : (
                  <View style={[styles.similarImage, { backgroundColor: colors.primaryTint }]} />
                )}
                <Text numberOfLines={2} style={[typography.caption, { color: colors.text.primary }]}>
                  {s.item.name}
                </Text>
                <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '700' }]}>
                  {formatCatalogMoney(catalogSalePrice(s), s.item.currency || 'XAF')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  bannerText: { flex: 1, fontWeight: '600' },
  similarRow: { flexDirection: 'row' },
  similarCard: { flex: 1, minHeight: 44, borderRadius: 8, padding: 8, gap: 4 },
  similarImage: { width: '100%', aspectRatio: 1, borderRadius: 6 },
});
