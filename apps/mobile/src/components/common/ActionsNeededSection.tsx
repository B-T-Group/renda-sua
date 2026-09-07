import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ActionNeededItem, type ActionNeededItemProps } from './ActionNeededItem';

export interface ActionsNeededSectionProps {
  items: Omit<ActionNeededItemProps, never>[];
  onMarkAllRead?: () => void;
}

/**
 * Renders a titled "Actions needed" section at the top of a home screen.
 * Returns null when there are no actionable items.
 */
export function ActionsNeededSection({
  items,
  onMarkAllRead,
}: ActionsNeededSectionProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows, spacing } = useTheme();

  const visible = items.filter((i) => (i.count ?? 1) > 0);
  if (visible.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, fontWeight: '700', flex: 1 }}
        >
          {t('actionsNeeded.title', 'Actions needed')}
        </Text>
        {onMarkAllRead ? (
          <Pressable onPress={onMarkAllRead} accessibilityRole="button">
            <Text
              variant="bodySmall"
              style={{ color: colors.primary.main, fontWeight: '600' }}
            >
              {t('actionsNeeded.markAllDone', 'Dismiss all')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.items}>
        {visible.map((item) => (
          <ActionNeededItem key={item.kind} {...item} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  items: {},
});
