import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = { size?: number; label: string };

/** A short route and truck for how delivery pay works. */
export function DeliveryPayIllustration({ size = 72, label }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle cx="36" cy="36" r="32" fill={primary} opacity={0.12} />
        <Path
          d="M14 46 C24 28 34 50 48 30"
          stroke={primary}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="14" cy="46" r="3" fill={colors.success.main} />
        <Circle cx="48" cy="30" r="3" fill={primary} />
        <Rect x="22" y="40" width="18" height="10" rx="2" fill={primary} />
        <Rect x="38" y="43" width="8" height="7" rx="1" fill={primary} opacity={0.75} />
        <Circle cx="27" cy="52" r="2.5" fill={paper} stroke={primary} strokeWidth="1.5" />
        <Circle cx="41" cy="52" r="2.5" fill={paper} stroke={primary} strokeWidth="1.5" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
