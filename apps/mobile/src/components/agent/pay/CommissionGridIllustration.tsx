import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = { size?: number; label: string };

/** Rising bars — a higher sales month earns a higher share. */
export function CommissionGridIllustration({ size = 72, label }: Props) {
  const { colors } = useTheme();
  const paper = colors.surface;
  const primary = colors.primary.main;

  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle cx="36" cy="36" r="34" fill={primary} opacity={0.12} />
        <Rect x="16" y="40" width="10" height="16" rx="2" fill={primary} opacity={0.45} />
        <Rect x="31" y="30" width="10" height="26" rx="2" fill={primary} opacity={0.7} />
        <Rect x="46" y="18" width="10" height="38" rx="2" fill={colors.success.main} />
        <Rect x="14" y="56" width="44" height="2" rx="1" fill={paper} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
