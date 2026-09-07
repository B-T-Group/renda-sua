import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';
import { NoticeBanner } from '../common/NoticeBanner';

export interface CartOrderSummaryProps {
  currency: string;
  subtotal: number;
  itemCount: number;
  sellerCount: number;
  mixedCountries: boolean;
  staleMetadata: boolean;
  merchantNotAccepting: boolean;
  checkoutDisabled: boolean;
  onCheckout: () => void;
  onLayout?: (height: number) => void;
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.body2, { color: colors.text.secondary, flex: 1, paddingRight: 8 }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.body2,
          { color: muted ? colors.text.secondary : colors.text.primary, fontWeight: muted ? '400' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function CartOrderSummary({
  currency,
  subtotal,
  itemCount,
  sellerCount,
  mixedCountries,
  staleMetadata,
  merchantNotAccepting,
  checkoutDisabled,
  onCheckout,
  onLayout,
}: CartOrderSummaryProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) onLayout?.(height);
      }}
      style={[
        styles.footer,
        shadows.md,
        {
          borderTopColor: colors.divider,
          backgroundColor: colors.surface,
          paddingBottom: insets.bottom + spacing.sm,
          paddingTop: spacing.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      {mixedCountries ? (
        <NoticeBanner
          tone="error"
          message={t(
            'cart.errors.mixedCountries',
            'Your cart contains items from different countries. Please remove items from one country to continue.'
          )}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}
      {staleMetadata ? (
        <NoticeBanner
          tone="warning"
          message={t(
            'cart.errors.staleMetadata',
            'Some items in your cart need to be refreshed. Please remove and re-add them to continue.'
          )}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}
      {merchantNotAccepting ? (
        <NoticeBanner
          tone="info"
          message={t(
            'cart.merchantNotAcceptingNotice',
            'Some sellers are still setting up payments. You can keep items in your cart, but checkout may be unavailable until they go live.'
          )}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}

      <SummaryRow
        label={t('cart.subtotalWithCount', 'Subtotal ({{count}} items)', { count: itemCount })}
        value={formatCatalogMoney(subtotal, currency)}
      />

      {/* Delivery trust strip */}
      <View style={[styles.deliveryTrust, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
        <MaterialCommunityIcons
          name="truck-fast-outline"
          size={16}
          color={colors.text.secondary}
        />
        <Text style={[typography.caption, { color: colors.text.secondary, flex: 1 }]}>
          {t(
            'cart.deliveryEta',
            'Usually 1–3 hrs · fee shown at checkout'
          )}
        </Text>
      </View>

      {sellerCount > 1 ? (
        <View style={[styles.multiSeller, { backgroundColor: colors.primaryTint }]}>
          <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.primary.main} />
          <Text style={[typography.caption, { color: colors.text.secondary, flex: 1, minWidth: 0 }]}>
            {t(
              'cart.multipleOrdersNotice',
              'Items will be split into {{count}} separate orders',
              { count: sellerCount }
            )}
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={[typography.h6, { color: colors.text.primary, fontWeight: '700' }]}>
          {t('cart.subtotal', 'Subtotal')}
        </Text>
        <Text style={[typography.h6, { color: colors.primary.main, fontWeight: '700' }]}>
          {formatCatalogMoney(subtotal, currency)}
        </Text>
      </View>

      <Button
        mode="contained"
        icon="cart-arrow-right"
        onPress={onCheckout}
        disabled={checkoutDisabled}
        style={{ marginTop: spacing.md }}
        contentStyle={{ height: 52 }}
      >
        {t('cart.placeOrder', 'Place order')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deliveryTrust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiSeller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
  },
});
