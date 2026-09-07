import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { PERSONA_ACCENT } from '@/constants/personaTheme';
import type { PersonaSlug } from '@/types/persona';
import {
  ENROLL_PERSONA_ICONS,
  enrollPitchDefault,
  enrollPitchKey,
} from './personaEnrollUi';

export interface MissingPersonaCardProps {
  persona: PersonaSlug;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function MissingPersonaCard({
  persona,
  onPress,
  loading = false,
  disabled = false,
}: MissingPersonaCardProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const accent = PERSONA_ACCENT[persona];
  const inactive = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderColor: colors.divider,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          opacity: pressed ? 0.92 : inactive ? 0.55 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons name={ENROLL_PERSONA_ICONS[persona]} size={22} color={accent} />
      <View style={styles.textCol}>
        <Text style={[typography.subtitle2, { color: colors.text.primary }]} numberOfLines={2}>
          {t(enrollPitchKey(persona), enrollPitchDefault(persona))}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary.main} />
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.disabled} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  textCol: { flex: 1, minWidth: 0 },
});
