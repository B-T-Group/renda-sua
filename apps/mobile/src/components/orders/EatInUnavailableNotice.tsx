import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { showEatInUnavailableNotice } from '../../utils/cookedFoodOrder';
import { TakeOutIllustration } from '../illustrations/TakeOutIllustration';

export function EatInUnavailableNotice({
  order,
}: {
  order: {
    eat_in?: boolean | null;
    eat_in_unavailable?: boolean | null;
    payment_status?: string | null;
  };
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  if (!showEatInUnavailableNotice(order)) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.warning.main + '22',
        marginBottom: spacing.sm,
      }}
    >
      <TakeOutIllustration size={64} />
      <Text style={[typography.body2, { flex: 1, color: colors.text.primary }]}>
        {t(
          'orders.eatIn.noTableClient',
          'There is no table. Approve the payment request to take this order out, or cancel it.'
        )}
      </Text>
    </View>
  );
}
