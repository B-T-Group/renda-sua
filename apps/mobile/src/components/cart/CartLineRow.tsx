import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { CartLine } from '../../types/cart';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';
import { useImageFallback } from '../../hooks/useImageFallback';
import { StatusPill } from '../common/StatusPill';

function lineSubtotal(line: CartLine): number {
  return line.itemData.price * line.quantity;
}

export interface CartLineRowProps {
  item: CartLine;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLineRow({ item, onUpdateQuantity, onRemove }: CartLineRowProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const image = useImageFallback(item.itemData.imageUrl);
  const minQty = item.itemData.minOrderQuantity ?? 1;
  const maxQty = item.itemData.maxOrderQuantity;
  const atMin = item.quantity <= minQty;
  const atMax = maxQty != null && item.quantity >= maxQty;
  const openingSoon = item.itemData.merchantCanAcceptOrders === false;

  return (
    <View
      style={[
        styles.row,
        shadows.sm,
        {
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
        },
      ]}
    >
      {image.hasImage && image.sourceUri ? (
        <Image
          source={{ uri: image.sourceUri }}
          style={[styles.thumb, { borderRadius: borderRadius.sm }]}
          resizeMode="cover"
          onError={image.onImageError}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbPh,
            { borderRadius: borderRadius.sm, backgroundColor: colors.pageBackground },
          ]}
        >
          <MaterialCommunityIcons name="image-off-outline" size={22} color={colors.text.disabled} />
        </View>
      )}

      <View style={styles.meta}>
        <Text numberOfLines={2} style={[typography.body2, styles.name, { color: colors.text.primary }]}>
          {item.itemData.name}
        </Text>
        {item.variantName ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
            {item.variantName}
          </Text>
        ) : null}
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
          {`${formatCatalogMoney(item.itemData.price, item.itemData.currency)} ${t('cart.each', 'each')}`}
        </Text>
        {openingSoon ? (
          <StatusPill
            compact
            label={t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
            backgroundColor={colors.warning.main + '22'}
            textColor={colors.warning.dark ?? colors.warning.main}
            style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}
          />
        ) : null}

        <View style={[styles.controls, { marginTop: spacing.sm }]}>
          <View
            style={[
              styles.stepper,
              { borderColor: colors.divider, borderRadius: borderRadius.sm, backgroundColor: colors.pageBackground },
            ]}
          >
            <Pressable
              onPress={() => onUpdateQuantity(item.quantity - 1)}
              disabled={atMin}
              accessibilityRole="button"
              accessibilityLabel={t('cart.decreaseQuantity', 'Decrease quantity')}
              style={({ pressed }) => [styles.stepBtn, { opacity: atMin ? 0.35 : pressed ? 0.7 : 1 }]}
            >
              <MaterialCommunityIcons name="minus" size={18} color={colors.text.primary} />
            </Pressable>
            <Text style={[styles.qty, { color: colors.text.primary }]}>{item.quantity}</Text>
            <Pressable
              onPress={() => onUpdateQuantity(item.quantity + 1)}
              disabled={atMax}
              accessibilityRole="button"
              accessibilityLabel={t('cart.increaseQuantity', 'Increase quantity')}
              style={({ pressed }) => [styles.stepBtn, { opacity: atMax ? 0.35 : pressed ? 0.7 : 1 }]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.text.primary} />
            </Pressable>
          </View>

          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t('cart.removeLine', 'Remove')}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 6 }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error.main} />
          </Pressable>
        </View>
        {maxQty != null ? (
          <Text style={[typography.caption, { color: colors.text.disabled, marginTop: 4 }]}>
            {t('cart.maxOrderQuantity', 'Max {{count}} per order', { count: maxQty })}
          </Text>
        ) : null}
      </View>

      <Text style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '700' }]}>
        {formatCatalogMoney(lineSubtotal(item), item.itemData.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  thumb: { width: 72, height: 72 },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0 },
  name: { fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
  stepBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 28, textAlign: 'center', fontWeight: '700' },
});
