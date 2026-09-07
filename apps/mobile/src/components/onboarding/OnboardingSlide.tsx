import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { OnboardingBulletRow } from './OnboardingBulletRow';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type OnboardingBullet = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
};

type Props = {
  width: number;
  title: string;
  bullets: OnboardingBullet[];
  illustration: React.ReactNode;
};

export function OnboardingSlide({ width, title, bullets, illustration }: Props) {
  const { colors, spacing, typography } = useTheme();
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.art, { marginBottom: spacing.lg }]}>{illustration}</View>
      <Text
        style={[
          styles.title,
          typography.display,
          { color: colors.text.primary, marginBottom: spacing.md },
        ]}
      >
        {title}
      </Text>
      <View>
        {bullets.map((b) => (
          <OnboardingBulletRow key={b.text} icon={b.icon} text={b.text} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  art: { alignItems: 'center' },
  title: { textAlign: 'center' },
});
