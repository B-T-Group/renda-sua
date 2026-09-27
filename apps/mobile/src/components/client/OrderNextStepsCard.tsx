import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { OrderNextStep, OrderNextStepsContent } from './orderPlacedNextSteps';

export function OrderNextStepsCard({ content }: { content: OrderNextStepsContent }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const palette = stepPalette(content.tone, colors);

  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: palette.background,
        borderColor: palette.border,
      }}
    >
      <Card.Content style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <Text variant="titleMedium" style={{ color: palette.title, fontWeight: '700' }}>
          {t(content.titleKey, content.titleDefault)}
        </Text>
        {content.steps.map((item, index) => (
          <StepRow
            key={item.id}
            index={index}
            step={item}
            color={palette.body}
            numberColor={palette.number}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

function StepRow({
  index,
  step,
  color,
  numberColor,
}: {
  index: number;
  step: OrderNextStep;
  color: string;
  numberColor: string;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
      <Text variant="labelLarge" style={{ color: numberColor, fontWeight: '700', width: 18 }}>
        {index + 1}
      </Text>
      <Text variant="bodyMedium" style={{ color, flex: 1, minWidth: 0, lineHeight: 22 }}>
        {t(step.key, step.defaultText, step.values)}
      </Text>
    </View>
  );
}

function stepPalette(
  tone: OrderNextStepsContent['tone'],
  colors: ReturnType<typeof useTheme>['colors']
) {
  if (tone === 'action') {
    return {
      background: colors.primary.dark,
      border: colors.primary.dark,
      title: colors.primary.contrast,
      body: colors.primary.contrast,
      number: colors.primary.contrast,
    };
  }
  if (tone === 'success') {
    return {
      background: colors.success.main + '14',
      border: colors.success.main,
      title: colors.success.dark,
      body: colors.text.primary,
      number: colors.success.dark,
    };
  }
  return {
    background: colors.info.main + '12',
    border: colors.info.main + '55',
    title: colors.info.dark,
    body: colors.info.dark,
    number: colors.info.dark,
  };
}
