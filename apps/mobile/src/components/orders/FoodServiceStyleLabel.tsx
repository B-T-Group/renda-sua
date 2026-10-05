import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { foodServiceStyle } from '../../utils/cookedFoodOrder';
import { EatInIllustration } from '../illustrations/EatInIllustration';
import { TakeOutIllustration } from '../illustrations/TakeOutIllustration';

export function FoodServiceStyleLabel({
  order,
}: {
  order: { is_cooked_food_pickup?: boolean | null; eat_in?: boolean | null };
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const style = foodServiceStyle(order);
  if (!style) return null;
  const eatIn = style === 'eat_in';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {eatIn ? <EatInIllustration size={40} /> : <TakeOutIllustration size={40} />}
      <Text style={[typography.subtitle2, { fontWeight: '700', color: colors.text.primary }]}>
        {eatIn ? t('orders.eatIn.eatIn', 'Eat in') : t('orders.eatIn.takeOut', 'Take out')}
      </Text>
    </View>
  );
}
