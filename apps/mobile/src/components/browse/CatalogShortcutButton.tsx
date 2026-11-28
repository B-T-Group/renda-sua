import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export function CatalogShortcutButton({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={styles.hit}
    >
      <View>
        <MaterialCommunityIcons name={icon} size={22} color={colors.primary.main} />
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
});
