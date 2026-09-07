import { StyleSheet, type ViewStyle } from 'react-native';
import { FAB } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface PrimaryCatalogFabProps {
  onPress: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
}

/** Prominent add action for business catalog screens. */
export function PrimaryCatalogFab({ onPress, accessibilityLabel, style }: PrimaryCatalogFabProps) {
  const { colors } = useTheme();

  return (
    <FAB
      icon="plus"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.fab, { backgroundColor: colors.primary.main }, style]}
      color={colors.primary.contrast}
      customSize={56}
    />
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
