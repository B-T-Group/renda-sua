import { View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  renterName: string;
  itemName: string;
  mode: 'push' | 'banner';
}

export function RentalHandoverNotice(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const copy = handoverCopy(props.renterName, props.itemName, t);
  return (
    <View
      accessibilityRole={props.mode === 'push' ? 'alert' : 'summary'}
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: props.mode === 'push' ? colors.surface : colors.success.main + '14',
        borderWidth: 1,
        borderColor: colors.success.main + '44',
      }}
    >
      <MaterialCommunityIcons
        name={props.mode === 'push' ? 'bell-outline' : 'handshake-outline'}
        size={22}
        color={colors.success.main}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.subtitle2, { color: colors.text.primary }]}>{copy.title}</Text>
        <Text style={[typography.body2, { color: colors.text.secondary }]}>{copy.body}</Text>
      </View>
    </View>
  );
}

function handoverCopy(name: string, item: string, t: ReturnType<typeof useTranslation>['t']) {
  return {
    title: t('rentals.business.pushStartedTitle', 'Rental started, hand over the item'),
    body: t(
      'rentals.business.pushStartedBody',
      '{{name}} started {{item}}. You can hand over the item.',
      { name, item }
    ),
  };
}
