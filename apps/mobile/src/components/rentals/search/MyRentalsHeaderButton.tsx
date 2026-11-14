import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';

export function MyRentalsHeaderButton({
  label,
  badge,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  badge: string | null;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="rental-my-rentals-entry"
      style={styles.hit}
    >
      <View>
        <MaterialCommunityIcons name="calendar-check" size={22} color={colors.primary.main} />
        {badge ? (
          <View
            testID="rental-my-rentals-badge"
            style={[styles.badge, { backgroundColor: colors.primary.main, borderColor: colors.pageBackground }]}
          >
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={[styles.caption, { color: colors.primary.main }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minWidth: 44, minHeight: 44, maxWidth: 88, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 10, fontWeight: '600', lineHeight: 12, maxWidth: 84, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800', lineHeight: 11 },
});
