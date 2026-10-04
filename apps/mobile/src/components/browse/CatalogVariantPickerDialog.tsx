import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { haptics } from '@/services/haptics';
import { AppButton } from '../common/AppButton';
import { BottomSheet } from '../common/BottomSheet';
import type { PickerConfirmResult } from '../../hooks/useCatalogVariantFlow';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogOrderedImages } from '../../utils/catalogInventoryDisplay';
import { shopperVariantOptions } from '../../utils/shopperVariantSelection';
import { VariantOptionPicker } from './VariantOptionPicker';

export interface CatalogVariantPickerDialogProps {
  open: boolean;
  item: CatalogInventoryItem | null;
  onDismiss: () => void;
  /** `added` when the cart quantity increased. `closed` when checkout continues. */
  onConfirm: (selectionId: string, quantity?: number) => PickerConfirmResult;
  confirmLabel?: string;
}

type GuestNav = {
  navigate: (name: string, params?: object) => void;
  getState?: () => { routeNames?: string[] };
};

function openGuestLogin(navigation: GuestNav) {
  const names = navigation.getState?.().routeNames ?? [];
  if (names.includes('GuestAuth')) {
    navigation.navigate('GuestAuth', { screen: 'Login' });
    return;
  }
  navigation.navigate('GuestTabs', {
    screen: 'GuestAuth',
    params: { screen: 'Login' },
  });
}

export function CatalogVariantPickerDialog({
  open,
  item,
  onDismiss,
  onConfirm,
  confirmLabel,
}: CatalogVariantPickerDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();
  const { auth } = useStore();
  const defaultLabel = t('orders.variant.defaultOption', 'Default');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [limitNote, setLimitNote] = useState<string | null>(null);

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
    setSelectedId(null);
    setQuantity(1);
    setAdded(false);
    setLimitNote(null);
  }, [open, item?.id]);

  const confirmText = confirmLabel || t('orders.variant.confirmSelection', 'Add to cart');
  const goToCart = () => {
    onDismiss();
    (navigation as { navigate: (name: string) => void }).navigate('Cart');
  };
  const goToCheckout = () => {
    onDismiss();
    if (auth.isAuthenticated) {
      (navigation as { navigate: (name: string) => void }).navigate('CartCheckout');
      return;
    }
    void auth.setPostAuthResumeForCartCheckout().then(() => {
      openGuestLogin(navigation as GuestNav);
    });
  };

  return (
    <BottomSheet
      visible={open && item != null}
      onClose={onDismiss}
      title={added ? t('cart.added', 'Added') : t('orders.variant.selectDialogTitle', 'Choose an option')}
      footer={
        added ? (
          <View style={styles.actions}>
            <AppButton label={t('cart.viewCart', 'View cart')} variant="outline" onPress={goToCart} style={styles.flex} />
            <AppButton label={t('checkout.progress.checkout', 'Checkout')} variant="cta" onPress={goToCheckout} style={styles.flex} />
          </View>
        ) : (
          <AppButton
            label={confirmText}
            variant="cta"
            disabled={!selectedId}
            onPress={() => {
              if (!selectedId) return;
              const result = onConfirm(selectedId, quantity);
              if (result !== 'added') {
                if (result === 'unchanged') {
                  haptics.warning();
                  setLimitNote(
                    t('cart.quantityUnavailable', 'That quantity is not available. Try a smaller amount.')
                  );
                }
                return;
              }
              setLimitNote(null);
              haptics.success();
              setAdded(true);
            }}
          />
        )
      }
    >
      {item && !added ? (
        <View>
          <VariantOptionPicker
            variants={options}
            value={selectedId}
            onChange={(id) => {
              haptics.selection();
              setSelectedId(id);
            }}
            listingSellingPrice={item.selling_price}
            priceOverrides={item.variant_price_overrides}
            hasActiveDeal={item.hasActiveDeal}
            originalPrice={item.original_price}
            discountedPrice={item.discounted_price}
            currency={item.item.currency || 'XAF'}
            hideHeading
          />
          <View style={styles.stepper}>
            <Text style={{ color: colors.text.secondary }}>{t('cart.quantity', 'Quantity')}</Text>
            <View style={styles.stepperBtns}>
              <Pressable accessibilityRole="button" onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.step}>
                <Text>−</Text>
              </Pressable>
              <Text>{quantity}</Text>
              <Pressable accessibilityRole="button" onPress={() => setQuantity((q) => q + 1)} style={styles.step}>
                <Text>+</Text>
              </Pressable>
            </View>
          </View>
          {limitNote ? (
            <Text style={{ color: colors.error.main, marginTop: spacing.sm }}>{limitNote}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: colors.text.primary, marginBottom: spacing.sm }}>
          {t('cart.addedBody', 'This item is in your cart.')}
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  stepperBtns: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
