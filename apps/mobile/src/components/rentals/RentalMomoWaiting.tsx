import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';

interface Props {
  amount: string;
  item: string;
  phone: string;
  onBack: () => void;
}

export function RentalMomoWaiting(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground, padding: spacing.lg, alignItems: 'center' }}>
      <MobileMoneyConfirmIllustration />
      <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.md }]}>
        {t('rentals.start.momoWaitingTitle', 'Approve on your phone')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm }]}>
        {t('rentals.start.momoWaitingBody', 'Approve the request on your phone. This page updates when the payment goes through.')}
      </Text>
      <View style={{ marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.divider, width: '100%', gap: 6 }}>
        <Text style={[typography.subtitle1, { color: colors.text.primary }]}>{props.amount}</Text>
        <Text style={[typography.body2, { color: colors.text.primary }]}>{props.item}</Text>
        <Text style={[typography.body2, { color: colors.text.secondary }]}>{props.phone}</Text>
      </View>
      <Button mode="text" onPress={props.onBack} style={{ marginTop: spacing.md }}>
        {t('common.back', 'Back')}
      </Button>
    </View>
  );
}
