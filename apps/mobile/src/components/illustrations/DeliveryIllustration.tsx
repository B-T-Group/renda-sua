import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Delivery bike for bringing the order to the customer. */
export function DeliveryIllustration({
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
      accessibilityLabel="Delivery"
      style={colored ? undefined : { filter: 'grayscale(1)', opacity: 0.72 }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="16" cy="44" r="11" fill="none" stroke="#1F2937" strokeWidth={3.5} />
        <Circle cx="16" cy="44" r="2.2" fill="#1F2937" />
        <Circle cx="48" cy="44" r="11" fill="none" stroke="#1F2937" strokeWidth={3.5} />
        <Circle cx="48" cy="44" r="2.2" fill="#1F2937" />
        <Path
          d="M16 44 L28 26 V44 H16 M28 26 H40 L48 44"
          fill="none"
          stroke="#1D4ED8"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M24 22h10" stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M40 26 L46 16" stroke="#1D4ED8" strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M42 14h10" stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round" />
        <Rect x="2" y="16" width="16" height="12" rx="2" fill="#0B7A3B" />
      </Svg>
    </View>
  );
}
