import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import type { CartLine } from '../../types/cart';
import type { ClientRootStackParamList, GuestRootStackParamList } from '../../navigation/types';
import { CartLineRow } from '../../components/cart/CartLineRow';
import { CartOrderSummary } from '../../components/cart/CartOrderSummary';
import { CartSaveAccountNudge } from '../../components/cart/CartSaveAccountNudge';
import { CheckoutProgressStepper } from '../../components/checkout/CheckoutProgressStepper';

type CartNav = NativeStackNavigationProp<ClientRootStackParamList | GuestRootStackParamList>;

function SellerHeader({ title, count }: { title: string; count: number }) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.sellerHeader,
        {
          backgroundColor: colors.primaryTint,
          borderRadius: borderRadius.sm,
          marginBottom: spacing.sm,
          marginTop: spacing.xs,
        },
      ]}
    >
      <MaterialCommunityIcons name="storefront-outline" size={18} color={colors.primary.main} />
      <View style={styles.sellerMeta}>
        <Text numberOfLines={1} style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '700' }]}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('cart.sellerItemCount', '{{count}} items', { count })}
        </Text>
      </View>
    </View>
  );
}

export default observer(function CartScreen() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const navigation = useNavigation<CartNav>();
  const { cart, auth } = useStore();
  const [signInPromptVisible, setSignInPromptVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(220);

  const countryInfo = cart.countryInfo;
  const itemCount = useMemo(
    () => cart.items.reduce((sum, line) => sum + line.quantity, 0),
    [cart.items]
  );

  const sectionsDisplay = useMemo(() => {
    const map = cart.groupedByBusiness;
    return [...map.entries()].map(([, lines]) => ({
      title: lines[0]?.businessName ?? t('cart.unnamedSeller', 'Seller ({{count}} items)', { count: lines.length }),
      data: lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
    }));
  }, [cart.groupedByBusiness, cart.items, t]);

  const proceedToGuestAuth = useCallback(async () => {
    setSignInPromptVisible(false);
    await auth.setPostAuthResumeForCartCheckout();
    (navigation as { navigate: (n: string, p?: object) => void }).navigate('GuestTabs', {
      screen: 'GuestAuth',
      params: { screen: 'Login' },
    });
  }, [auth, navigation]);

  const proceedToGuestSignup = useCallback(async () => {
    setSignInPromptVisible(false);
    await auth.setPostAuthResumeForCartCheckout();
    (navigation as { navigate: (n: string, p?: object) => void }).navigate('GuestTabs', {
      screen: 'GuestAuth',
      params: { screen: 'Signup' },
    });
  }, [auth, navigation]);

  const onCheckout = useCallback(async () => {
    if (cart.hasCheckoutBlockingCountryIssue) return;
    if (!auth.isAuthenticated) {
      setSignInPromptVisible(true);
      return;
    }
    (navigation as NativeStackNavigationProp<ClientRootStackParamList>).navigate('CartCheckout');
  }, [auth, cart, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: CartLine }) => (
      <CartLineRow
        item={item}
        onUpdateQuantity={(quantity) => cart.updateQuantity(item.inventoryItemId, quantity, item.variantId)}
        onRemove={() => cart.removeLine(item.inventoryItemId, item.variantId)}
      />
    ),
    [cart]
  );

  if (cart.items.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.primaryTint, borderRadius: borderRadius.lg },
          ]}
        >
          <MaterialCommunityIcons name="cart-outline" size={48} color={colors.primary.main} />
        </View>
        <Text style={[typography.h6, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.md }]}>
          {t('cart.empty', 'Your cart is empty')}
        </Text>
        <Text
          style={[
            typography.body2,
            { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280 },
          ]}
        >
          {t('cart.emptyDescription', 'Browse stores and add items — your cart will show up here.')}
        </Text>
        <Button mode="contained" style={{ marginTop: spacing.lg }} onPress={() => navigation.goBack()}>
          {t('cart.continueShopping', 'Continue shopping')}
        </Button>
      </View>
    );
  }

  const currency = cart.items[0]?.itemData.currency ?? 'XAF';

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <SectionList
        sections={sectionsDisplay.map((s) => ({ title: s.title, data: s.data, count: s.count }))}
        keyExtractor={(item) => `${item.inventoryItemId}::${item.variantId ?? ''}`}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <SellerHeader title={section.title} count={section.count} />
        )}
        ListHeaderComponent={
          <>
            <CheckoutProgressStepper
              steps={[
                { key: 'cart', label: t('checkout.progress.cart', 'Cart') },
                { key: 'checkout', label: t('checkout.progress.checkout', 'Checkout') },
                { key: 'pay', label: t('checkout.progress.pay', 'Pay') },
              ]}
              currentStep="cart"
            />
            <CartSaveAccountNudge />
            <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
              {t('cart.listHeader', '{{itemCount}} items from {{sellerCount}} sellers', {
                itemCount,
                sellerCount: sectionsDisplay.length,
              })}
            </Text>
          </>
        }
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: footerHeight + spacing.md,
        }}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />

      <CartOrderSummary
        currency={currency}
        subtotal={cart.subtotal}
        itemCount={itemCount}
        sellerCount={sectionsDisplay.length}
        mixedCountries={countryInfo.status === 'mixed_countries'}
        staleMetadata={countryInfo.status === 'stale_metadata'}
        merchantNotAccepting={cart.hasMerchantNotAcceptingLines}
        checkoutDisabled={cart.hasCheckoutBlockingCountryIssue}
        onCheckout={() => void onCheckout()}
        onLayout={setFooterHeight}
      />

      <Portal>
        <Dialog
          visible={signInPromptVisible}
          onDismiss={() => setSignInPromptVisible(false)}
          style={{ borderRadius: borderRadius.lg }}
        >
          <View style={styles.dialogIconRow}>
            <MaterialCommunityIcons name="cart-check" size={36} color={colors.primary.main} />
          </View>
          <Dialog.Title style={{ textAlign: 'center' }}>
            {t('cart.signInPrompt.title', 'Sign in to checkout')}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {t(
                'cart.signInPrompt.body',
                'Your cart will be saved. Sign in or create an account to complete your order.'
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setSignInPromptVisible(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={() => void proceedToGuestSignup()}>
              {t('cart.signInPrompt.signupCta', 'Create account')}
            </Button>
            <Button mode="contained" onPress={() => void proceedToGuestAuth()}>
              {t('cart.signInPrompt.cta', 'Sign in')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sellerMeta: { flex: 1, minWidth: 0 },
  dialogIconRow: { alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  dialogActions: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
});
