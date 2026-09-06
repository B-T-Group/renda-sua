import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface StarRatingDisplayProps {
  average: number;
  count?: number | null;
  size?: number;
  style?: object;
}

function starIcon(average: number, index: number): 'star' | 'star-half-full' | 'star-outline' {
  if (average >= index) return 'star';
  if (average >= index - 0.5) return 'star-half-full';
  return 'star-outline';
}

/** Read-only compact star rating row: stars + average + (count). */
export function StarRatingDisplay({ average, count, size = 14, style }: StarRatingDisplayProps) {
  const { colors, typography } = useTheme();
  if (!average || average <= 0) return null;
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="image"
      accessibilityLabel={`${average.toFixed(1)} out of 5 stars${count ? `, ${count} ratings` : ''}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons
          key={n}
          name={starIcon(average, n)}
          size={size}
          color={colors.warning.main}
        />
      ))}
      <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 2 }]}>
        {average.toFixed(1)}
        {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
});
