import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';

const TARGET = 48;

export function InspectionBanner({
  tone,
  children,
}: {
  tone: 'warning' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const background =
    tone === 'warning' ? colors.warningTint : tone === 'success' ? colors.successTint : colors.infoTint;
  const border = tone === 'warning' ? colors.warning.main : tone === 'success' ? colors.success.main : colors.info.main;
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: background,
          borderColor: border,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[typography.body2, { color: colors.text.primary }]}>{children}</Text>
    </View>
  );
}

export function UnitTabs({
  labels,
  active,
  done,
  onSelect,
  accent = 'business',
}: {
  labels: string[];
  active: number;
  done: boolean[];
  onSelect: (index: number) => void;
  accent?: 'client' | 'business';
}) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const selectedBorder = accent === 'client' ? colors.primary.main : colors.cta.main;
  const selectedFill = accent === 'client' ? colors.primarySubtle : colors.cta.soft;
  const selectedText = accent === 'client' ? colors.primary.dark : colors.cta.dark;
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {labels.map((label, index) => {
        const selected = index === active;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(index)}
            style={[
              styles.tab,
              {
                borderRadius: borderRadius.lg,
                borderColor: selected ? selectedBorder : colors.border,
                backgroundColor: selected ? selectedFill : colors.surface,
              },
            ]}
          >
            <Text style={[typography.subtitle2, { color: selected ? selectedText : colors.text.primary }]}>
              {done[index] ? `${label} ✓` : label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  tab: { minHeight: TARGET, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
