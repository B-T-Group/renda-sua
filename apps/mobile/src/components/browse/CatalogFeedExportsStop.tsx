import React, { memo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogImageDisplayUrl } from '../../utils/catalogInventoryDisplay';

export interface CatalogFeedExportsStopProps {
  items: CatalogInventoryItem[];
  onItemPress?: (inventoryItemId: string) => void;
  onSeeAllExports?: () => void;
}

const CARD_WIDTH = 140;
const CARD_IMAGE_HEIGHT = 120;

/**
 * "Available for export" mid-feed stop for destination markets.
 */
export const CatalogFeedExportsStop = memo(function CatalogFeedExportsStop({
  items,
  onItemPress,
  onSeeAllExports,
}: CatalogFeedExportsStopProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  if (items.length === 0) return null;

  return (
    <View
      style={[
        styles.section,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <View
        style={[
          styles.headerRow,
          { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        ]}
      >
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.secondary.main + '15' },
            ]}
          >
            <MaterialCommunityIcons
              name="airplane"
              size={18}
              color={colors.secondary.main}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="titleSmall"
              style={{ fontWeight: '800', color: colors.text.primary }}
            >
              {t('exportCatalog.sectionTitle', 'Available for export')}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.secondary, marginTop: 2 }}
            >
              {t(
                'exportCatalog.sectionSubtitle',
                'Goods listed from Canada — request interest to import'
              )}
            </Text>
          </View>
        </View>
        {onSeeAllExports ? (
          <Button mode="text" compact onPress={onSeeAllExports}>
            {t('exportCatalog.seeAll', 'See all exports')}
          </Button>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          gap: spacing.sm,
        }}
      >
        {items.slice(0, 8).map((item) => {
          const uri = catalogImageDisplayUrl(item);
          return (
            <Pressable
              key={item.id}
              onPress={() => onItemPress?.(item.id)}
              style={[
                styles.card,
                {
                  width: CARD_WIDTH,
                  borderRadius: borderRadius.md,
                  borderColor: colors.divider,
                  backgroundColor: colors.background.paper,
                },
              ]}
            >
              <View
                style={{
                  height: CARD_IMAGE_HEIGHT,
                  backgroundColor: colors.grey[200],
                  borderTopLeftRadius: borderRadius.md,
                  borderTopRightRadius: borderRadius.md,
                  overflow: 'hidden',
                }}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : null}
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.secondary.main },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.secondary.contrastText,
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {t('exportCatalog.badge', 'Export')}
                  </Text>
                </View>
              </View>
              <View style={{ padding: spacing.sm }}>
                <Text
                  numberOfLines={2}
                  style={{
                    ...typography.body2,
                    fontWeight: '600',
                    color: colors.text.primary,
                    minHeight: 36,
                  }}
                >
                  {item.item.name}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.primary.main,
                    marginTop: 4,
                    fontWeight: '700',
                  }}
                >
                  {t('productInterest.priceNotApplicable', 'Price on request')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
