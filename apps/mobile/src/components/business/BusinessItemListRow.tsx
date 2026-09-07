import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Divider, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';
import { useLanguage } from '../../hooks/useLanguage';
import type { BusinessCatalogItem } from '../../types/business/items';
import {
  itemHasLowStock,
  itemIsOutOfStock,
  itemLocationCount,
  itemThumbUrl,
} from '../../utils/businessItemUtils';
import {
  canToggleItemActive,
  itemModerationColors,
  itemModerationDefaultLabel,
  itemModerationLabelKey,
} from '../../utils/items/itemStatusUi';
import { resolveFoodToggleTarget } from '../../utils/businessFood';
import { formatCurrency } from '../../utils/formatters';
import { FoodSoldOutToggle } from './food/FoodSoldOutToggle';
import { BusinessItemRowActions } from './BusinessItemRowActions';

const THUMB = 96;

export interface BusinessItemListRowProps {
  item: BusinessCatalogItem;
  onPressDetails?: () => void;
  onPressEdit?: () => void;
  onItemMutated?: () => void;
}

export function BusinessItemListRow({ item, onPressDetails, onPressEdit, onItemMutated }: BusinessItemListRowProps) {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const locale = currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
  const { colors, spacing, borderRadius } = useTheme();

  const thumbUri = useMemo(() => itemThumbUrl(item), [item]);
  const locCount = useMemo(() => itemLocationCount(item), [item]);
  const foodToggle = useMemo(() => resolveFoodToggleTarget(item), [item]);
  const outOfStock = useMemo(() => itemIsOutOfStock(item), [item]);
  const lowStock = useMemo(() => itemHasLowStock(item), [item]);
  const cur = item.currency || 'XAF';
  const moderation = item.moderation_status;
  const showActivePill = canToggleItemActive(moderation) || !moderation;
  const modColors =
    moderation && moderation !== 'approved'
      ? itemModerationColors(moderation, colors)
      : null;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View
        style={[
          {
            borderRadius: borderRadius.card,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
            backgroundColor: colors.surface,
          },
          shadows.sm,
        ]}
      >
        <Pressable
          onPress={onPressDetails}
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          accessibilityRole="button"
        >
          <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.md }}>
            <View
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: borderRadius.md,
                overflow: 'hidden',
                backgroundColor: colors.divider,
              }}
            >
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="image-off-outline" size={32} color={colors.text.secondary} />
                </View>
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.xxs }}>
                {modColors ? (
                  <StatusPill
                    compact
                    label={t(
                      itemModerationLabelKey(moderation),
                      itemModerationDefaultLabel(moderation)
                    )}
                    backgroundColor={modColors.backgroundColor}
                    textColor={modColors.textColor}
                  />
                ) : null}
                {showActivePill && item.is_active === false ? (
                  <StatusPill
                    compact
                    label={t('business.items.inactive', 'Inactive')}
                    backgroundColor={colors.divider}
                    textColor={colors.text.secondary}
                  />
                ) : null}
                {outOfStock ? (
                  <StatusPill
                    compact
                    label={t('business.items.outOfStock', 'Out of stock')}
                    backgroundColor={`${colors.error.light}44`}
                    textColor={colors.error.dark}
                  />
                ) : lowStock ? (
                  <StatusPill
                    compact
                    label={t('business.items.lowStock', 'Low stock')}
                    backgroundColor={`${colors.warning.light}66`}
                    textColor={colors.warning.dark}
                  />
                ) : null}
                {item.is_favorite ? (
                  <MaterialCommunityIcons name="star" size={16} color={colors.warning.dark} />
                ) : null}
              </View>
              <Text variant="titleMedium" style={{ fontWeight: '700' }} numberOfLines={2}>
                {item.name}
              </Text>
              {item.sku ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
                  {t('business.items.sku', 'SKU')}: {item.sku}
                </Text>
              ) : null}
              {item.price != null ? (
                <Text variant="titleSmall" style={{ color: colors.primary.main, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(item.price, cur, locale)}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.text.secondary} />
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {locCount} {t('business.items.locationsCount', 'location(s)')}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          {foodToggle ? (
            <View style={{ marginBottom: spacing.sm }}>
              <FoodSoldOutToggle
                itemId={item.id}
                businessLocationId={foodToggle.businessLocationId}
                initialSoldOut={foodToggle.soldOut}
                onChanged={onItemMutated}
              />
            </View>
          ) : null}
          <BusinessItemRowActions
            item={item}
            toggleVariant="inline"
            hideViewButton={Boolean(onPressDetails)}
            onView={onPressDetails}
            onEdit={onPressEdit}
            onSuccess={onItemMutated}
          />
          {onPressDetails ? (
            <>
              <Divider style={{ marginVertical: spacing.sm }} />
              <Pressable
                onPress={onPressDetails}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="labelLarge" style={{ color: colors.primary.main, fontWeight: '600' }}>
                  {t('business.items.viewDetails', 'View details')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary.main} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
