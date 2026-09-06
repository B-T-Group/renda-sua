import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

export interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Right-aligned action element displayed next to the title */
  titleAction?: React.ReactNode;
  /** If true, removes card padding so children control their own spacing */
  noPadding?: boolean;
}

/**
 * Reusable section container with optional heading and right-side action.
 * Enforces the design system card radius, shadow, and background color.
 */
export function SectionCard({
  title,
  children,
  style,
  contentStyle,
  titleAction,
  noPadding = false,
}: SectionCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
        },
        style,
      ]}
    >
      {title ? (
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.xxs,
            },
          ]}
        >
          <Text
            style={[
              typography.subheading,
              { color: colors.text.primary, flex: 1 },
            ]}
          >
            {title}
          </Text>
          {titleAction ?? null}
        </View>
      ) : null}
      <View
        style={[
          noPadding
            ? null
            : {
                paddingHorizontal: spacing.md,
                paddingBottom: spacing.md,
                paddingTop: spacing.xxs,
              },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
