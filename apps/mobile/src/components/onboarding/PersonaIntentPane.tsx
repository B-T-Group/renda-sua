import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { PersonaIntent } from '../../constants/onboarding';
import { PersonaIntentCard } from './PersonaIntentCard';

type Props = {
  width: number;
  onSelect: (intent: PersonaIntent) => void;
};

const CARDS: Array<{
  intent: PersonaIntent;
  icon: 'shopping-outline' | 'storefront-outline' | 'moped' | 'compass-outline';
  titleKey: string;
  titleDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
}> = [
  {
    intent: 'buy',
    icon: 'shopping-outline',
    titleKey: 'ftue.intent.buy',
    titleDefault: 'Buy',
    subtitleKey: 'ftue.intent.buySubtitle',
    subtitleDefault: 'Shop local products near you',
  },
  {
    intent: 'sell',
    icon: 'storefront-outline',
    titleKey: 'ftue.intent.sell',
    titleDefault: 'Sell',
    subtitleKey: 'ftue.intent.sellSubtitle',
    subtitleDefault: 'Open your store in minutes',
  },
  {
    intent: 'deliver',
    icon: 'moped',
    titleKey: 'ftue.intent.deliver',
    titleDefault: 'Deliver',
    subtitleKey: 'ftue.intent.deliverSubtitle',
    subtitleDefault: 'Earn money as a delivery partner',
  },
];

export function PersonaIntentPane({ width, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[
          styles.title,
          typography.display,
          { color: colors.text.primary, marginBottom: spacing.sm },
        ]}
      >
        {t('ftue.intent.title', 'What would you like to do today?')}
      </Text>
      <Text
        style={[
          typography.body,
          {
            color: colors.text.secondary,
            textAlign: 'center',
            marginBottom: spacing.md,
          },
        ]}
      >
        {t(
          'ftue.intent.subtitle',
          'This personalizes recommendations. You can change it anytime.'
        )}
      </Text>
      {CARDS.map((c) => (
        <PersonaIntentCard
          key={c.intent}
          intent={c.intent}
          icon={c.icon}
          title={t(c.titleKey, c.titleDefault)}
          subtitle={t(c.subtitleKey, c.subtitleDefault)}
          onPress={() => onSelect(c.intent)}
        />
      ))}
      <Button
        mode="text"
        onPress={() => onSelect('explore')}
        style={{ marginTop: spacing.sm }}
        labelStyle={{ fontWeight: '600' }}
      >
        {t('ftue.intent.explore', 'Explore without an account')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  title: { textAlign: 'center' },
});
