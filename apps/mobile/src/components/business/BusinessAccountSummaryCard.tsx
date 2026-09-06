import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { getPlanById } from '../../types/business/accountType';
import type { BusinessRootStackParamList } from '../../navigation/types';

interface Props {
  accountType?: string | null;
}

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

/**
 * Subtle dashboard link to the business plans page, tinted by plan color.
 */
export function BusinessAccountSummaryCard({ accountType }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<Nav>();
  const plan = getPlanById(accountType);
  const planLabel = t(plan.labelKey, plan.defaultLabel);

  return (
    <Pressable
      onPress={() => navigation.navigate('BusinessAccountTypeScreen')}
      accessibilityRole="link"
      accessibilityLabel={t(
        'business.accountType.dashboardLinkA11y',
        'Account type: {{type}}. Open plans.',
        { type: planLabel }
      )}
      style={({ pressed }) => [
        styles.row,
        {
          marginBottom: spacing.sm,
          opacity: pressed ? 0.75 : 1,
          backgroundColor: plan.softColor,
          borderRadius: borderRadius.sm,
          borderColor: `${plan.color}33`,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
        },
      ]}
      hitSlop={8}
    >
      <View style={[styles.dot, { backgroundColor: plan.color }]} />
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t('business.accountType.dashboardLinkPrefix', 'Account type:')}{' '}
        <Text style={{ color: plan.color, fontWeight: '700' }}>{planLabel}</Text>
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: plan.color, fontWeight: '700', marginLeft: 6 }}
      >
        →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 32,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
