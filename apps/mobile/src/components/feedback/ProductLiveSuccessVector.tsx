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
  playToken: number;
};

function Sparkle({ delay, x, y, color, playToken }: SparkleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (playToken <= 0) return;
    opacity.setValue(0);
    translateY.setValue(8);
    scale.setValue(0.4);
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    const loop = Animated.loop(
      Animated.sequence([anim, Animated.delay(400)])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, playToken, scale, translateY]);

  return (
    <AnimatedView
      style={[
        styles.sparkle,
        {
          left: x,
          top: y,
          opacity,
          transform: [{ translateY }, { scale }],
          backgroundColor: color,
        },
      ]}
    />
  );
}

type Props = {
  playToken?: number;
  size?: number;
};

export function ProductLiveSuccessVector({ playToken = 1, size = 128 }: Props) {
  const { colors } = useTheme();
  const mainScale = useRef(new Animated.Value(0.5)).current;
  const mainOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.85)).current;
  const ringOpacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (playToken <= 0) return;
    mainScale.setValue(0.5);
    mainOpacity.setValue(0);
    ringScale.setValue(0.85);
    ringOpacity.setValue(0.35);

    Animated.parallel([
      Animated.spring(mainScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(mainOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.12, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.12, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.92, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.32, duration: 1400, useNativeDriver: true }),
        ]),
      ])
    );
    ringLoop.start();
    return () => ringLoop.stop();
  }, [mainOpacity, mainScale, playToken, ringOpacity, ringScale]);

  const primary = colors.primary.main;
  const success = colors.success.main;
  const sparkleColor = colors.secondary.main;

  return (
    <View
      style={[styles.wrap, { width: size + 48, height: size + 48 }]}
      accessibilityRole="image"
      accessibilityLabel="Success"
    >
      <AnimatedView
        style={[
          styles.ring,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            borderColor: success,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Sparkle playToken={playToken} delay={200} x={8} y={12} color={sparkleColor} />
      <Sparkle playToken={playToken} delay={420} x={size + 28} y={20} color={primary} />
      <Sparkle playToken={playToken} delay={560} x={size + 8} y={size - 8} color={sparkleColor} />
      <Sparkle playToken={playToken} delay={300} x={16} y={size + 4} color={success} />

      <AnimatedView style={{ opacity: mainOpacity, transform: [{ scale: mainScale }] }}>
        <Svg width={size} height={size} viewBox="0 0 128 128">
          <Rect x="24" y="44" width="80" height="56" rx="12" fill={primary} opacity={0.12} />
          <Rect x="28" y="48" width="72" height="48" rx="10" fill={primary} />
          <Path d="M28 58 H100" stroke={colors.primary.contrast} strokeWidth={2} opacity={0.35} />
          <Rect x="40" y="66" width="48" height="6" rx="3" fill={colors.primary.contrast} opacity={0.5} />
          <Rect x="40" y="78" width="32" height="6" rx="3" fill={colors.primary.contrast} opacity={0.35} />
          <Circle cx="92" cy="92" r="22" fill={success} />
          <Path
            d="M82 92 L88 98 L102 82"
            stroke="#fff"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
