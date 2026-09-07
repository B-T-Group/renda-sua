import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import { shadows } from '@/theme/shadows';

export interface UserMenuSectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Shared menu section container used across Client, Business, and Delivery
 * Agent menus. Groups UserMenuRow children under a section label with
 * consistent background, border, shadow, and radius treatment.
 */
export function UserMenuSection({ title, children }: UserMenuSectionProps) {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={[styles.wrapper, { marginBottom: spacing.lg }]}>
      <Text
        variant="labelSmall"
        style={[
          styles.title,
          { color: colors.text.disabled, paddingHorizontal: spacing.md },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.body,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            borderRadius: borderRadius.card,
            overflow: 'hidden',
          },
        ]}
      >
        {React.Children.map(children, (child, index) => {
          const childCount = React.Children.count(children);
          return (
            <>
              {child}
              {index < childCount - 1 ? (
                <View
                  style={[
                    styles.divider,
                    {
                      backgroundColor: colors.divider,
                      marginHorizontal: spacing.md,
                    },
                  ]}
                />
              ) : null}
            </>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  title: {
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  body: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
