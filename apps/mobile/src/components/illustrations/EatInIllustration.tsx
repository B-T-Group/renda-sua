import { View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

/** Set table: plate of food on a wooden table. */
export function EatInIllustration({
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
      accessibilityLabel="Eat in"
      style={colored ? undefined : { filter: 'grayscale(1)', opacity: 0.72 }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Ellipse cx="32" cy="26" rx="20" ry="11" fill="#FFF8F1" stroke="#E4D3C0" strokeWidth={2} />
        <Ellipse cx="32" cy="24" rx="11" ry="6" fill="#F4A261" />
        <Circle cx="23" cy="22" r="4" fill="#2A9D8F" />
        <Circle cx="41" cy="21" r="3.5" fill="#E76F51" />
        <Circle cx="32" cy="20" r="2.2" fill="#E9C46A" />
        <Rect x="2" y="36" width="60" height="10" rx="2" fill="#E7C08A" />
        <Rect x="2" y="44" width="60" height="4" fill="#B8884E" />
        <Rect x="8" y="48" width="6" height="12" rx="2" fill="#8D5A2B" />
        <Rect x="50" y="48" width="6" height="12" rx="2" fill="#8D5A2B" />
      </Svg>
    </View>
  );
}
