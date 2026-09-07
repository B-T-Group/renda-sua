import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import {
  openAddressInMaps,
  type AddressFields,
} from '../orders/shared/AddressCard';

export interface PickupStoreLocatorProps {
  address?: AddressFields | null;
  storeName?: string | null;
  contactName?: string | null;
  phone?: string | null;
}

function formatStoreAddress(address: AddressFields): string {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function StoreAddressLink({
  address,
  storeName,
}: {
  address: AddressFields;
  storeName?: string | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const formatted = formatStoreAddress(address);
  if (!formatted) return null;

  return (
    <Pressable
      onPress={() => openAddressInMaps(address)}
      accessibilityRole="link"
      accessibilityLabel={t(
        'orders.pickupLocator.openInMapsA11y',
        'Open store address in Maps'
      )}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.primary.main + '44',
          backgroundColor: pressed
            ? colors.primary.main + '18'
            : colors.background.paper,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
          gap: spacing.xxs,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.header, { gap: spacing.xxs }]}>
        <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary.main} />
        <Text
          variant="labelMedium"
          style={{ color: colors.primary.main, fontWeight: '700', flex: 1, minWidth: 0 }}
        >
          {storeName?.trim()
            ? storeName
            : t('orders.pickupLocator.address', 'Store address')}
        </Text>
        <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary.main} />
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.primary }}>
        {formatted}
      </Text>
      <Text variant="labelSmall" style={{ color: colors.primary.main }}>
        {t('orders.pickupLocator.openInMaps', 'Open in Maps')}
      </Text>
    </Pressable>
  );
}

function StorePhoneLink({
  phone,
  contactName,
}: {
  phone: string;
  contactName?: string | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <Pressable
      onPress={() => void Linking.openURL(`tel:${phone}`)}
      accessibilityRole="link"
      accessibilityLabel={t('orders.pickupLocator.callStoreA11y', 'Call the store')}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.divider,
          backgroundColor: colors.background.paper,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.header, { gap: spacing.xxs }]}>
        <MaterialCommunityIcons name="phone" size={18} color={colors.primary.main} />
        <Text
          variant="labelMedium"
          style={{ color: colors.text.primary, fontWeight: '700', flex: 1, minWidth: 0 }}
        >
          {contactName?.trim()
            ? contactName
            : t('orders.pickupLocator.contact', 'Store contact')}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ color: colors.primary.main }}>
        {phone}
      </Text>
    </Pressable>
  );
}

export function PickupStoreLocator({
  address,
  storeName,
  contactName,
  phone,
}: PickupStoreLocatorProps) {
  const { spacing } = useTheme();
  const phoneTrimmed = phone?.trim() || '';
  const hasAddress = !!address && !!formatStoreAddress(address);
  if (!hasAddress && !phoneTrimmed) return null;

  return (
    <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
      {hasAddress && address ? (
        <StoreAddressLink address={address} storeName={storeName} />
      ) : null}
      {phoneTrimmed ? (
        <StorePhoneLink phone={phoneTrimmed} contactName={contactName} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
});
