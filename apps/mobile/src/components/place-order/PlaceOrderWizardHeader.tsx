import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ProgressBar, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface PlaceOrderWizardHeaderProps {
  step: 1 | 2 | 3;
  totalSteps?: number;
}

export function PlaceOrderWizardHeader({ step, totalSteps = 3 }: PlaceOrderWizardHeaderProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const progress = step / totalSteps;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="labelLarge" style={{ color: colors.primary.main, fontWeight: '700', marginBottom: spacing.xs }}>
        {t('client.placeOrder.wizard.stepLabel', 'Step {{current}} of {{total}}', { current: step, total: totalSteps })}
      </Text>
      <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '700', marginBottom: spacing.sm }}>
        {step === 1
          ? t('client.placeOrder.wizard.titleAddress', 'Delivery address')
          : step === 2
            ? t('client.placeOrder.wizard.titlePhone', 'Mobile Money number')
            : t('client.placeOrder.wizard.titleCheckout', 'Review and place order')}
      </Text>
      <ProgressBar progress={progress} color={colors.primary.main} style={{ height: 6, borderRadius: borderRadius.sm }} />
    </View>
  );
}
