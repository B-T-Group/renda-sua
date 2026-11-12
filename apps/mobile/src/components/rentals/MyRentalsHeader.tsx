import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily } from '../../theme/fonts';

export function MyRentalsHeader({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        hitSlop={8}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={[typography.h6, { color: colors.text.primary, fontFamily: fontFamily.semibold, flex: 1 }]}
      >
        {title}
      </Text>
    </View>
  );
}
