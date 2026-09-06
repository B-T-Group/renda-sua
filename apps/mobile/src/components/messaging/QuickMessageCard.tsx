import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { QuickMessageStructuredContent } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';

type Props = {
  content: QuickMessageStructuredContent;
};

export function QuickMessageCard({ content }: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, shadows, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.primary.main,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={t('orders.quickMessages.cardA11y', 'Quick message')}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="message-flash-outline"
          size={18}
          color={colors.primary.main}
        />
        <Text style={[typography.subtitle2, { color: colors.text.primary, flex: 1 }]}>
          {t('orders.quickMessages.title', 'Quick message')}
        </Text>
      </View>
      <Text style={[typography.body2, { color: colors.text.primary, marginTop: spacing.xs }]}>
        {t(content.bodyI18nKey, content.bodyDefault)}
      </Text>
      {content.taggedPersonas.length > 0 ? (
        <View style={[styles.tags, { marginTop: spacing.sm, gap: spacing.xs }]}>
          {content.taggedPersonas.map((persona) => {
            const labelKey =
              persona === 'client'
                ? 'persona.clientTitle'
                : persona === 'agent'
                  ? 'persona.agentTitle'
                  : persona === 'business'
                    ? 'persona.businessTitle'
                    : `persona.${persona}`;
            const fallback =
              persona === 'client'
                ? 'Client'
                : persona === 'agent'
                  ? 'Delivery agent'
                  : persona === 'business'
                    ? 'Business'
                    : persona;
            return (
              <StatusPill
                key={persona}
                label={t(labelKey, fallback)}
                backgroundColor={colors.pageBackground}
                textColor={colors.text.secondary}
                borderColor={colors.divider}
                compact
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    maxWidth: 360,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
