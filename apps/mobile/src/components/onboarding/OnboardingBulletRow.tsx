import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
};

export function OnboardingBulletRow({ icon, text }: Props) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.sm }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary.main} />
      </View>
      <Text
        style={[
          styles.text,
          typography.body,
          { color: colors.text.secondary },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
});
