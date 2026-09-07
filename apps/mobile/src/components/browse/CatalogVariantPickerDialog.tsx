import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogOrderedImages } from '../../utils/catalogInventoryDisplay';
import { shopperVariantOptions } from '../../utils/shopperVariantSelection';
import { VariantOptionPicker } from './VariantOptionPicker';

export interface CatalogVariantPickerDialogProps {
  open: boolean;
  item: CatalogInventoryItem | null;
  onDismiss: () => void;
  /** Called with shopper selection id (`__base__` or variant UUID). */
  onConfirm: (selectionId: string) => void;
  confirmLabel?: string;
}

export function CatalogVariantPickerDialog({
  open,
  item,
  onDismiss,
  onConfirm,
  confirmLabel,
}: CatalogVariantPickerDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const defaultLabel = t('orders.variant.defaultOption', 'Default');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const optionsMaxHeight = Math.min(360, screenHeight * 0.45);

  const parentImageUrl = useMemo(() => {
    if (!item) return null;
    return catalogOrderedImages(item)[0]?.image_url ?? null;
  }, [item]);

  const options = useMemo(() => {
    if (!item) return [];
    return shopperVariantOptions({
      defaultLabel,
      variants: item.item.item_variants,
      parentImageUrl,
    });
  }, [item, defaultLabel, parentImageUrl]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    setSelectedId(null);
  }, [open, item?.id]);

  if (!item) return null;

  const confirmText =
    confirmLabel || t('orders.variant.confirmSelection', 'Add to cart');

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary }]}
          >
            {t('orders.variant.selectDialogTitle', 'Choose an option')}
          </Text>

          <View style={{ paddingHorizontal: spacing.md, flexShrink: 1 }}>
            <VariantOptionPicker
              variants={options}
              value={selectedId}
              onChange={setSelectedId}
              listingSellingPrice={item.selling_price}
              priceOverrides={item.variant_price_overrides}
              hasActiveDeal={item.hasActiveDeal}
              originalPrice={item.original_price}
              discountedPrice={item.discounted_price}
              currency={item.item.currency || 'XAF'}
              hideHeading
              maxHeight={optionsMaxHeight}
            />
          </View>

          <View
            style={[
              styles.actions,
              { paddingHorizontal: spacing.lg, gap: spacing.sm },
            ]}
          >
            <Button mode="text" onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              disabled={!selectedId}
              onPress={() => {
                if (!selectedId) return;
                onConfirm(selectedId);
              }}
            >
              {confirmText}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    paddingTop: 20,
  },
  title: {
    paddingHorizontal: 24,
    marginBottom: 8,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
  },
});
