import { Pressable } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { AppImage } from '../common/AppImage';

type Props = {
  uri: string;
  index: number;
  width: number;
  height: number;
  scrollX: SharedValue<number>;
  label: string;
  onPress: () => void;
  onLoadSize?: (width: number, height: number) => void;
};

export function GalleryParallaxPage({
  uri,
  index,
  width,
  height,
  scrollX,
  label,
  onPress,
  onLoadSize,
}: Props) {
  const motion = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [(index - 1) * width, index * width, (index + 1) * width],
          [-width * 0.12, 0, width * 0.12],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width, height }}>
      <Animated.View style={[{ width, height }, motion]}>
        <AppImage uri={uri} recyclingKey={uri} contentFit="contain" style={{ width, height }} onLoadSize={onLoadSize} accessibilityLabel={label} />
      </Animated.View>
    </Pressable>
  );
}
