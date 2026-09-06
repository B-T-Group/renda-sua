import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { isNonProdEnv } from '../../config/envSwitch';
import type { SavedAccount } from '../../types/savedAccount';
import { agentInitial } from '../../utils/agentProfileDisplay';
import { formatLastUsed, formatLastUsedCount } from '../../utils/formatLastUsed';

export interface SavedAccountCardProps {
  account: SavedAccount;
  onPress: () => void;
  disabled?: boolean;
}

export function SavedAccountCard({ account, onPress, disabled }: SavedAccountCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const displayName = account.label?.trim() || account.displayName;
  const initials = agentInitial({
    firstName: displayName.split(' ')[0],
    lastName: displayName.split(' ').slice(1).join(' '),
    email: account.email,
    phoneNumber: account.phone,
  });

  const lastUsedKey = formatLastUsed(account.lastUsedAt);
  const lastUsedCount = formatLastUsedCount(account.lastUsedAt);

  const lastUsedLabel = (() => {
    switch (lastUsedKey) {
      case 'just_now':
        return t('savedAccounts.lastUsed.justNow', 'Last used just now');
      case 'minute':
        return t('savedAccounts.lastUsed.minute', 'Last used 1 minute ago');
      case 'minutes':
        return t('savedAccounts.lastUsed.minutes', 'Last used {{count}} minutes ago', {
          count: lastUsedCount ?? 1,
        });
      case 'hour':
        return t('savedAccounts.lastUsed.hour', 'Last used 1 hour ago');
      case 'hours':
        return t('savedAccounts.lastUsed.hours', 'Last used {{count}} hours ago', {
          count: lastUsedCount ?? 1,
        });
      case 'today':
        return t('savedAccounts.lastUsed.today', 'Last used today');
      case 'yesterday':
        return t('savedAccounts.lastUsed.yesterday', 'Last used yesterday');
      case 'days':
        return t('savedAccounts.lastUsed.days', 'Last used {{count}} days ago', {
          count: lastUsedCount ?? 1,
        });
      default:
        return t('savedAccounts.lastUsed.date', 'Last used {{date}}', {
          date: new Date(account.lastUsedAt).toLocaleDateString(),
        });
    }
  })();

  const envLabel =
    account.environment === 'prod'
      ? t('savedAccounts.env.production', 'Production')
      : account.environment === 'local'
        ? t('savedAccounts.env.local', 'Local')
        : t('savedAccounts.env.development', 'Development');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('savedAccounts.cardA11y', 'Continue as {{name}}', {
        name: displayName,
      })}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {account.avatar ? (
          <Image source={{ uri: account.avatar }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: colors.primaryTint },
            ]}
          >
            <Text variant="titleMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
              {initials}
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {displayName}
          </Text>
          {isNonProdEnv(account.environment) ? (
            <View style={[styles.badges, { gap: spacing.xs, marginTop: spacing.xs }]}>
              <StatusPill
                label={envLabel}
                backgroundColor={colors.warning.main + '18'}
                textColor={colors.warning.main}
                compact
              />
            </View>
          ) : null}
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: spacing.xs }}
          >
            {lastUsedLabel}
          </Text>
        </View>

        <View style={styles.trailing}>
          {account.biometricEnabled ? (
            <MaterialCommunityIcons
              name="face-recognition"
              size={20}
              color={colors.text.secondary}
              accessibilityLabel={t('savedAccounts.biometricEnabled', 'Biometrics enabled')}
            />
          ) : null}
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.disabled} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
});
