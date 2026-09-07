import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../constants/personaTheme';
import type { PersonaId } from '../../services/agentApi';

interface MentionChipProps {
  displayName: string;
  persona: PersonaId;
  onRemove?: () => void;
}

export function MentionChip({ displayName, persona, onRemove }: MentionChipProps) {
  const { colors } = useTheme();
  const bg = PERSONA_ACCENT[persona as keyof typeof PERSONA_ACCENT] ?? colors.primary.main;

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <MaterialCommunityIcons
        name="at"
        size={12}
        color="#fff"
        style={styles.icon}
      />
      <Text style={styles.label} numberOfLines={1}>
        {displayName}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove mention"
        >
          <MaterialCommunityIcons name="close" size={12} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  icon: { marginRight: 2 },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 160,
  },
});
