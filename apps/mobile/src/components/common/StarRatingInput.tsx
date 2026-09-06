import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
}

/** Tappable 1–5 star input row (theme-aware). */
export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  size = 34,
}: StarRatingInputProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => !disabled && onChange(n)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${n} stars`}
        >
          <MaterialCommunityIcons
            name={value >= n ? 'star' : 'star-outline'}
            size={size}
            color={value >= n ? colors.primary.main : colors.text.disabled}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
});
