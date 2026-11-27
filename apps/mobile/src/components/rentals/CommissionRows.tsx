import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export function CommissionRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
      <Text style={{ color: strong ? colors.text.primary : colors.text.secondary, fontWeight: strong ? '800' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: colors.text.primary, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}
