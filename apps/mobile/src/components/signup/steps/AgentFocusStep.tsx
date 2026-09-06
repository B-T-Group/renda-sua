import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { AgentFocus } from '@/types/agentFocus';

const OPTIONS: Array<{
  id: AgentFocus;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
}> = [
  {
    id: 'delivery',
    titleKey: 'agent.focus.deliveryTitle',
    titleDefault: 'Delivery',
    bodyKey: 'agent.focus.deliveryBody',
    bodyDefault: 'Pick up and deliver orders to customers.',
  },
  {
    id: 'commercial',
    titleKey: 'agent.focus.commercialTitle',
    titleDefault: 'Recruit businesses',
    bodyKey: 'agent.focus.commercialBody',
    bodyDefault: 'Help local shops join Rendasua and follow them through setup.',
  },
  {
    id: 'both',
    titleKey: 'agent.focus.bothTitle',
    titleDefault: 'Both',
    bodyKey: 'agent.focus.bothBody',
    bodyDefault: 'Deliver orders and recruit businesses.',
  },
];

interface Props {
  value: AgentFocus | '';
  disabled?: boolean;
  onChange: (focus: AgentFocus) => void;
}

export function AgentFocusStep({ value, disabled, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            disabled={disabled}
            onPress={() => onChange(opt.id)}
            style={{
              borderWidth: 1,
              borderColor: selected ? colors.primary.main : colors.divider,
              backgroundColor: selected ? colors.primaryTint : colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            }}
          >
            <Text
              variant="titleMedium"
              style={{ color: colors.text.primary, fontWeight: '700' }}
            >
              {t(opt.titleKey, opt.titleDefault)}
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.secondary, marginTop: 4 }}
            >
              {t(opt.bodyKey, opt.bodyDefault)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
