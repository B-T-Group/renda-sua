import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export function BusinessReturnedBanner({
  title,
  body,
  onConfirm,
  onProblem,
}: {
  title: string;
  body: string;
  onConfirm: () => void;
  onProblem: () => void;
}) {
  const { t } = useTranslation();
  const { spacing, borderRadius, typography, colors } = useTheme();
  return (
    <View
      testID="business-return-report"
      style={{
        borderWidth: 1,
        borderColor: '#0B7A3B55',
        backgroundColor: '#F3F8F4',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <Text style={[typography.subtitle1, { fontWeight: '700', color: colors.text.primary }]}>
        {title}
      </Text>
      <Text style={[typography.body2, { marginTop: spacing.xs, color: colors.text.primary }]}>{body}</Text>
      <Button mode="contained" buttonColor="#0B7A3B" style={{ marginTop: spacing.md, minHeight: 48 }} onPress={onConfirm}>
        {t('rentals.returnReport.confirmReturn', 'Confirm return')}
      </Button>
      <Button mode="outlined" textColor="#B42318" style={{ marginTop: spacing.sm, minHeight: 48 }} onPress={onProblem}>
        {t('rentals.returnReport.reportProblem', 'Report a problem')}
      </Button>
    </View>
  );
}
