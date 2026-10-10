import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number; label: string };

/** Shop and coin — nothing left to collect on this list. */
export function PayEmptyIllustration({ size = 120, label }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.1} />
        <Rect x="28" y="46" width="40" height="34" rx="8" fill={primary} />
        <Path d="M28 56 H68" stroke={paper} strokeWidth="2" opacity={0.4} />
        <Rect x="36" y="62" width="14" height="10" rx="2" fill={paper} opacity={0.9} />
        <Circle cx="84" cy="68" r="16" fill={colors.success.main} />
        <Path
          d="M84 60 V76 M76 68 H92"
          stroke={paper}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});