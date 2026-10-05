import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Takeout bag the customer collects. */
export function TakeOutIllustration({
  size = 96,
  colored = true,
}: {
  size?: number;
  colored?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Take out"
      style={colored ? undefined : { filter: 'grayscale(1)', opacity: 0.72 }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path
          d="M12 20h40l-4 38H16L12 20z"
          fill="#F6D7A8"
          stroke="#C9956A"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Path
          d="M24 20c0-8 4-12 8-12s8 4 8 12"
          fill="none"
          stroke="#8D5A2B"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Rect x="16" y="34" width="32" height="8" fill="#0B7A3B" />
        <Circle cx="32" cy="38" r="2" fill="#F6D7A8" />
      </Svg>
    </View>
  );
}
