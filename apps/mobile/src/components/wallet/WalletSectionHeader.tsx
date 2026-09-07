import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export interface WalletSectionHeaderProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  hint: string;
}

export function WalletSectionHeader({ icon, title, hint }: WalletSectionHeaderProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.sm }]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.primaryTint,
            borderRadius: borderRadius.full,
            marginRight: spacing.sm,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary.main} />
      </View>
      <View style={styles.textCol}>
        <Text
          style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}
          numberOfLines={2}
        >
          {hint}
        </Text>
      </View>
    </View>
  );
}

/** Convenience wrapper that supplies translated personal-section copy. */
export function PersonalWalletSectionHeader() {
  const { t } = useTranslation();
  return (
    <WalletSectionHeader
      icon="account-outline"
      title={t('accounts.personalSection', 'Personal wallet')}
      hint={t(
        'accounts.personalSectionHint',
        'Balances linked directly to your user account.'
      )}
    />
  );
}

/** Convenience wrapper that supplies translated locations-section copy. */
export function LocationsWalletSectionHeader() {
  const { t } = useTranslation();
  return (
    <WalletSectionHeader
      icon="store-outline"
      title={t('accounts.locationsSection', 'Business locations')}
      hint={t(
        'accounts.locationsSectionHint',
        'Balances for each of your store locations.'
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
});
