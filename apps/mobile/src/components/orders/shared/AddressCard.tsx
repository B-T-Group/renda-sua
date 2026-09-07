import { Linking, Platform, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';

/** Address shape aligned with `src/types/agent.ts` Address. */
export interface AddressFields {
  id?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  instructions?: string | null;
}

export interface AddressCardProps {
  title: string;
  address?: AddressFields | null;
  instructions?: string | null;
  showNavigate?: boolean;
  onNavigate?: () => void;
  emptyLabel?: string;
}

function formatAddress(address: AddressFields): string {
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

export function openAddressInMaps(address: AddressFields) {
  const lat =
    address.latitude != null ? Number(address.latitude) : Number.NaN;
  const lng =
    address.longitude != null ? Number(address.longitude) : Number.NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const label = formatAddress(address);
  const url = hasCoords
    ? Platform.select({
        ios: `maps:0,0?q=${lat},${lng}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      })
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`;
  if (url) void Linking.openURL(url);
}

export function AddressCard({
  title,
  address,
  instructions,
  showNavigate = false,
  onNavigate,
  emptyLabel,
}: AddressCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const notes = instructions ?? address?.instructions;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={[styles.titleRow, { gap: spacing.xs, marginBottom: spacing.sm }]}>
        <MaterialCommunityIcons
          name="map-marker"
          size={18}
          color={colors.primary.main}
        />
        <Text variant="titleSmall" style={{ fontWeight: '700', flex: 1 }}>
          {title}
        </Text>
      </View>
      {address ? (
        <Text variant="bodyMedium">{formatAddress(address)}</Text>
      ) : (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {emptyLabel ??
            t('orders.address.unavailable', 'Address unavailable')}
        </Text>
      )}
      {notes ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
            {t('orders.address.instructions', 'Instructions')}
          </Text>
          <Text variant="bodyMedium">{notes}</Text>
        </View>
      ) : null}
      {showNavigate && address ? (
        <Button
          mode="contained"
          icon="navigation"
          onPress={onNavigate ?? (() => openAddressInMaps(address))}
          style={{ marginTop: spacing.sm }}
          compact
        >
          {t('orders.address.navigate', 'Navigate')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
});
