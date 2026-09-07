import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { PersonaIntent } from '../../constants/onboarding';

type Props = {
  intent: PersonaIntent;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

export function PersonaIntentCard({ title, subtitle, icon, onPress }: Props) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          padding: spacing.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
        <MaterialCommunityIcons name={icon} size={28} color={colors.primary.main} />
      </View>
      <View style={styles.textCol}>
        <Text style={[typography.subheading, { color: colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
          {subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    minHeight: 72,
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
