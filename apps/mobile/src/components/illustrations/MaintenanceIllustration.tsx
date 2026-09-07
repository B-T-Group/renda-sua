import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

/** Paused service: tools beside a stopped clock. */
export function MaintenanceIllustration() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Services unavailable"
      style={{ alignItems: 'center' }}
    >
      <Svg width={140} height={112} viewBox="0 0 140 112">
        <Circle cx="52" cy="56" r="32" fill={colors.primary.light} opacity={0.35} />
        <Circle
          cx="52"
          cy="56"
          r="22"
          fill="none"
          stroke={colors.primary.main}
          strokeWidth={3}
          opacity={0.8}
        />
        <Path
          d="M52 42v16l10 6"
          stroke={colors.primary.main}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect
          x="86"
          y="48"
          width="28"
          height="10"
          rx="3"
          fill={colors.warning.main}
          opacity={0.7}
        />
        <Path
          d="M100 58v22"
          stroke={colors.warning.main}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
