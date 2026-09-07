import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonBone } from '../common/SkeletonBone';

export interface AgentReferredBusinessesHeroProps {
  count: number | null;
  loading: boolean;
  onPress: () => void;
}

export function AgentReferredBusinessesHero({
  count,
  loading,
  onPress,
}: AgentReferredBusinessesHeroProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const value = count ?? 0;
  const isEmpty = !loading && value === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(
        'agent.businessReferrals.heroA11y',
        'Businesses referred so far. Tap to learn about referring businesses.'
      )}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
          padding: spacing.md,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary.main }]}>
        <MaterialCommunityIcons
          name="storefront-outline"
          size={24}
          color={colors.primary.contrast}
        />
      </View>
      <View style={styles.textCol}>
        <Text
          variant="labelSmall"
          style={{ color: colors.text.secondary, letterSpacing: 0.4 }}
        >
          {t('agent.businessReferrals.heroLabel', 'Businesses referred')}
        </Text>
        {loading ? (
          <SkeletonBone height={28} width={72} style={{ marginVertical: 6 }} />
        ) : (
          <Text
            variant="headlineMedium"
            style={{ color: colors.text.primary, fontWeight: '700', marginTop: 2 }}
          >
            {value.toLocaleString()}
          </Text>
        )}
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
          {isEmpty
            ? t(
                'agent.businessReferrals.heroEmptyHint',
                'Tap to learn how referring businesses earns you commission'
              )
            : t(
                'agent.businessReferrals.heroHint',
                'Tap to see benefits, responsibilities, and your code'
              )}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.text.secondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
});
