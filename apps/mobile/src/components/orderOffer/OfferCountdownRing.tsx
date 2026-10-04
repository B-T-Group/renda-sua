import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '../common/AppText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 52;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

type Props = {
  secondsLeft: number;
  total: number;
  color: string;
};

export function OfferCountdownRing({ secondsLeft, total, color }: Props) {
  const progress = useSharedValue(total > 0 ? secondsLeft / total : 0);
  useEffect(() => {
    progress.value = withTiming(total > 0 ? Math.max(0, secondsLeft) / total : 0, { duration: 200 });
  }, [progress, secondsLeft, total]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));
  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color} strokeOpacity={0.2} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={props}
          strokeLinecap="round"
        />
      </Svg>
      <AppText role="label" style={styles.label}>{`${secondsLeft}s`}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute' },
});
