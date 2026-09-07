import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { UserAdminCardHeader } from './UserAdminCardHeader';
import type { AdminClientUser } from '../../types/adminUsers';
import { formatAdminDateTime } from '../../utils/formatAdminDateTime';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  item: AdminClientUser;
  onPress?: (item: AdminClientUser) => void;
}

export function ClientUserCard({ item, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();

  const primaryAccount = item.accounts?.find((a) => a.is_active) ?? item.accounts?.[0];
  const addressCount = item.addresses?.length ?? 0;

  return (
    <Pressable
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${item.user.first_name} ${item.user.last_name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          opacity: pressed && onPress ? 0.88 : 1,
          ...shadows.sm,
        },
      ]}
    >
      <UserAdminCardHeader
        firstName={item.user.first_name}
        lastName={item.user.last_name}
        email={item.user.email}
        phone={item.user.phone_number}
      />

      {/* Stats row */}
      <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
        {primaryAccount ? (
          <View style={styles.statCell}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text
              style={[typography.caption, { color: colors.text.secondary, marginLeft: 4 }]}
              numberOfLines={1}
            >
              {formatCurrency(primaryAccount.available_balance, primaryAccount.currency)}
            </Text>
          </View>
        ) : null}
        {addressCount > 0 ? (
          <View style={styles.statCell}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={14}
              color={colors.text.secondary}
            />
            <Text
              style={[typography.caption, { color: colors.text.secondary, marginLeft: 4 }]}
            >
              {t('admin.users.client.addresses', 'Addresses')}: {addressCount}
            </Text>
          </View>
        ) : null}
        <View style={styles.statCell}>
          <MaterialCommunityIcons
            name="account-clock-outline"
            size={14}
            color={colors.text.secondary}
          />
          <Text
            style={[typography.caption, { color: colors.text.secondary, marginLeft: 4 }]}
            numberOfLines={1}
          >
            {formatAdminDateTime(item.created_at) ??
              new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
