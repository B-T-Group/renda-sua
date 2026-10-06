import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RendaCharacter } from '@/components/assistant/renda/RendaCharacter';

export interface AssistantIconButtonProps {
  onPress: () => void;
  style?: object;
  /**
   * #451 (flag `assistant_launcher_v1`, client / guest only, where the
   * launcher is hidden): render the 28 px static character with dot eyes
   * instead of the line icon.
   */
  character?: boolean;
}

/** Compact header control that opens the AI assistant chat. */
export function AssistantIconButton({ onPress, style, character = false }: AssistantIconButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('assistant.openA11y', 'Ask Rendasua assistant')}
      style={[styles.btn, style]}
    >
      {character ? (
        <RendaCharacter size={28} state="idle" animated={false} />
      ) : (
        <MaterialCommunityIcons name="robot-outline" size={24} color={colors.primary.main} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
});
