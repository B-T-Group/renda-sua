import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { UserAddress } from '../../types/agent';
import { isAddressComplete } from '../../utils/addressCompleteness';

function formatAddressLine(a: UserAddress): string {
  return [a.address_line_1, a.city, a.state, a.country].filter(Boolean).join(', ');
}

function AddressOptionRow({
  address,
  selected,
  onSelect,
  showIncompleteWarning,
}: {
  address: UserAddress;
  selected: boolean;
  onSelect: () => void;
  showIncompleteWarning: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const incomplete = showIncompleteWarning && !isAddressComplete(address);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: incomplete
            ? colors.warning.main
            : selected
              ? colors.primary.light
              : colors.border,
          backgroundColor: selected ? `${colors.primary.main}12` : colors.surface,
          opacity: pressed ? 0.88 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? colors.primary.main : colors.text.disabled },
        ]}
      >
        {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary.main }]} /> : null}
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyMedium" style={{ color: colors.text.primary, lineHeight: 22 }} numberOfLines={4}>
          {formatAddressLine(address)}
        </Text>
        {address.is_primary ? (
          <Text variant="labelSmall" style={{ color: colors.primary.main, marginTop: spacing.xxs }}>
            {t('client.placeOrder.defaultAddress', 'Default address')}
          </Text>
        ) : null}
        {incomplete ? (
          <Text
            variant="labelSmall"
            style={{ color: colors.warning.dark, marginTop: spacing.xxs }}
            numberOfLines={2}
          >
            {t('checkout.incompleteAddress.rowWarning', 'Incomplete — missing city, region, or postal code')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export interface PlaceOrderDeliveryAddressBlockProps {
  addresses: UserAddress[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddAddress: () => void;
  /** When true, mark incomplete addresses (e.g. Stripe delivery checkout). */
  warnIncomplete?: boolean;
  title?: string;
  helperText?: string;
  emptyMessage?: string;
  addCta?: string;
}

export function PlaceOrderDeliveryAddressBlock({
  addresses,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  onAddAddress,
  warnIncomplete = false,
  title,
  helperText,
  emptyMessage,
  addCta,
}: PlaceOrderDeliveryAddressBlockProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const heading = title ?? t('client.placeOrder.addressTitle', 'Deliver to');
  const addLabel = addCta ?? t('client.placeOrder.addAddressCta', 'Add delivery address');
  const emptyCopy =
    emptyMessage ??
    t('client.placeOrder.noAddresses', 'Add an address in your profile to place a delivery order.');

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.border,
          backgroundColor: colors.pageBackground,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary.main}14` }]}>
          <Icon source="map-marker-outline" size={22} color={colors.primary.main} />
        </View>
        <Text variant="titleSmall" style={{ flex: 1, color: colors.text.primary, fontWeight: '600' }}>
          {heading}
        </Text>
      </View>
      {helperText ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.sm, lineHeight: 20 }}
        >
          {helperText}
        </Text>
      ) : null}

      {loading ? (
        <View style={[styles.centerRow, { marginTop: spacing.md }]}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text variant="bodySmall" style={{ marginLeft: spacing.sm, color: colors.text.secondary }}>
            {t('client.placeOrder.addressLoading', 'Loading your addresses…')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={{ marginTop: spacing.md }}>
          <Text variant="bodySmall" style={{ color: colors.error.main }}>
            {error}
          </Text>
          <Button mode="text" compact onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {!loading && !error && addresses.length === 0 ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, lineHeight: 22 }}>
            {emptyCopy}
          </Text>
          <Button mode="contained-tonal" icon="map-marker-plus" onPress={onAddAddress}>
            {addLabel}
          </Button>
        </View>
      ) : null}

      {!loading && !error && addresses.length > 0 ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          {addresses.map((a) => (
            <AddressOptionRow
              key={a.id}
              address={a}
              selected={selectedId === a.id}
              onSelect={() => onSelect(a.id)}
              showIncompleteWarning={warnIncomplete}
            />
          ))}
          <Button mode="text" compact icon="map-marker-plus" onPress={onAddAddress} style={{ alignSelf: 'flex-start' }}>
            {addLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    paddingTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
