import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily } from '../../theme/fonts';

export function MyRentalsHeader({
  title,
  backLabel,
  onBack,
  findLabel,
  onFind,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  findLabel?: string;
  onFind?: () => void;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: spacing.sm }}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          hitSlop={8}
          style={styles.hit}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          typography.h6,
          {
            color: colors.text.primary,
            fontFamily: fontFamily.semibold,
            fontWeight: 'normal',
            flex: 1,
          },
        ]}
      >
        {title}
      </Text>
      {onFind ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={findLabel}
          onPress={onFind}
          hitSlop={8}
          testID="rental-tab-find"
          style={styles.hit}
        >
          <MaterialCommunityIcons name="magnify" size={22} color={colors.primary.main} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
