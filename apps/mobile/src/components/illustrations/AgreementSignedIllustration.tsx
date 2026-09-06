import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

const AnimatedView = Animated.createAnimatedComponent(View);

type SparkleProps = {
  delay: number;
  x: number;
  y: number;
  color: string;
};

function Sparkle({ delay, x, y, color }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 6,
            tension: 120,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -8,
            duration: 700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, opacity, scale, translateY]);

  return (
    <AnimatedView
      style={[
        styles.sparkle,
        {
          left: x,
          top: y,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

/** Signed agreement: document + check badge with light celebration sparkles. */
export function AgreementSignedIllustration() {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Merchant agreement signed"
      style={styles.wrap}
    >
      <AnimatedView style={{ opacity, transform: [{ scale }] }}>
        <Svg width={148} height={132} viewBox="0 0 148 132">
          <Circle cx="74" cy="66" r="54" fill={colors.success.light} opacity={0.28} />
          <Rect
            x="42"
            y="28"
            width="52"
            height="68"
            rx="8"
            fill={colors.surface}
            stroke={colors.primary.main}
            strokeWidth={2.5}
          />
          <Path
            d="M52 44h32M52 56h28M52 68h22"
            stroke={colors.text.secondary}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.45}
          />
          <Circle cx="98" cy="86" r="22" fill={colors.success.main} />
          <Path
            d="M88 86l6.5 6.5L108 78"
            stroke={colors.primary.contrast}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </AnimatedView>
      <Sparkle delay={120} x={18} y={28} color={colors.warning.main} />
      <Sparkle delay={380} x={122} y={22} color={colors.info.main} />
      <Sparkle delay={560} x={28} y={96} color={colors.primary.main} />
      <Sparkle delay={740} x={118} y={98} color={colors.success.main} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 160,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
