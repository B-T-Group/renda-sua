import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  onPress: () => void;
  visible?: boolean;
};

export function OnboardingSkipButton({ onPress, visible = true }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <Button
      mode="text"
      onPress={onPress}
      compact
      labelStyle={[styles.label, { color: colors.text.secondary }]}
      accessibilityLabel={t('ftue.onboarding.skip', 'Skip')}
    >
      {t('ftue.onboarding.skip', 'Skip')}
    </Button>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600', fontSize: 15 },
});
