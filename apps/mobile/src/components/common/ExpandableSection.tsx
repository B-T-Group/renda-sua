import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  /** Optional count shown next to the title (e.g. completed orders). */
  count?: number;
}

/**
 * Collapsible section that hides secondary content behind a toggle.
 * Used for progressive disclosure in the order detail view and order lists.
 */
export function ExpandableSection({
  title,
  children,
  defaultExpanded = false,
  count,
}: ExpandableSectionProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const a11yLabel =
    typeof count === 'number' ? `${title}, ${count}` : title;

  return (
    <View style={[styles.container, { borderColor: colors.divider, borderRadius: borderRadius.md }]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          {
            backgroundColor: colors.surface,
            borderRadius: expanded ? 0 : borderRadius.md,
            borderTopLeftRadius: borderRadius.md,
            borderTopRightRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={a11yLabel}
      >
        <Text variant="labelMedium" style={[styles.title, { color: colors.text.secondary }]}>
          {title}
        </Text>
        {typeof count === 'number' ? (
          <Text
            variant="labelSmall"
            style={{
              color: colors.text.secondary,
              marginRight: spacing.xs,
              fontWeight: '700',
            }}
          >
            {count}
          </Text>
        ) : null}
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.text.disabled}
        />
      </Pressable>
      {expanded && (
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.divider,
              borderBottomLeftRadius: borderRadius.md,
              borderBottomRightRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.md,
              paddingTop: spacing.sm,
            },
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.3,
    flex: 1,
  },
  content: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
