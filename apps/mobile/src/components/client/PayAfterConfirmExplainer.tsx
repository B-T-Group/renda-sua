import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from '../common/AppText';

/** Four-step reassurance for pay-after-the-store-confirms. */
export function PayAfterConfirmExplainer() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const steps = [
    t('client.payAfter.step1', 'The store confirms it is available'),
    t('client.payAfter.step2', 'You get a payment request'),
    t('client.payAfter.step3', 'Pay within the time window'),
    t('client.payAfter.step4', 'The store prepares your order'),
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.card, padding: spacing.md }]}>
      <AppText role="h3">{t('client.payAfter.title', 'Pay after the store confirms')}</AppText>
      <AppText role="bodySmall" style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
        {t('client.payAfter.body', 'Nothing is charged until the store says it can fulfil this order.')}
      </AppText>
      {steps.map((step, index) => (
        <View key={step} style={[styles.step, { marginTop: spacing.xs }]}>
          <AppText role="label" color={colors.primary.main}>{`${index + 1}`}</AppText>
          <AppText role="body" style={{ flex: 1, marginLeft: spacing.sm }}>{step}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
});
