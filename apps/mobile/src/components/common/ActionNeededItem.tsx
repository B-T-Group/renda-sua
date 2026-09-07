import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActionPriority } from '@/types/actions';

export interface ActionNeededItemProps {
  kind: string;
  title: string;
  subtitle?: string;
  icon: string;
  count?: number;
  priority: ActionPriority;
  onPress: () => void;
}

function useToneColor(priority: ActionPriority): string {
  const { colors } = useTheme();
  if (priority === 'critical') return colors.error.main;
  if (priority === 'high') return colors.warning.dark;
  return colors.primary.main;
}

export function ActionNeededItem({
  title,
  subtitle,
  icon,
  count,
  priority,
  onPress,
}: ActionNeededItemProps) {
  const { colors, borderRadius, shadows } = useTheme();
  const toneColor = useToneColor(priority);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: toneColor,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: toneColor + '18' }]}>
        <Icon source={icon} size={22} color={toneColor} />
      </View>
      <View style={styles.textWrap}>
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, fontWeight: '600' }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: 2 }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {count !== undefined && count > 0 ? (
        <View style={[styles.badge, { backgroundColor: toneColor }]}>
          <Text
            variant="labelSmall"
            style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}
          >
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      ) : null}
      <Icon source="chevron-right" size={22} color={colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1, minWidth: 0 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
