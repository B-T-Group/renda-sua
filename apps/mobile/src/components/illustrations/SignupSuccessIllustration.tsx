import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

const AnimatedView = Animated.createAnimatedComponent(View);

type Persona = 'client' | 'agent' | 'business';

type Props = {
  persona: Persona;
  promo?: boolean;
  size?: number;
  accessibilityLabel: string;
};

function Sparkle({
  delay,
  x,
  y,
  color,
}: {
  delay: number;
  x: number;
  y: number;
  color: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          Animated.timing(translateY, {
            toValue: -8,
            duration: 700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 360, useNativeDriver: true }),
        Animated.delay(480),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, opacity, scale, translateY]);

  return (
    <AnimatedView
      style={[styles.sparkle, { left: x, top: y, backgroundColor: color, opacity, transform: [{ translateY }, { scale }] }]}
    />
  );
}

function ClientArt({ accent, paper, size }: { accent: string; paper: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d="M38 48h44l-6 52H44L38 48z" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" fill={`${accent}18`} />
      <Path d="M48 48V40c0-6.6 5.4-12 12-12s12 5.4 12 12v8" stroke={accent} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Circle cx="92" cy="92" r="20" fill={paper} />
    </Svg>
  );
}

function AgentArt({ accent, paper, size }: { accent: string; paper: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Ellipse cx="40" cy="88" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}12`} />
      <Ellipse cx="82" cy="88" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}12`} />
      <Path d="M32 88h56M48 88V58h20l14 14v16" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x="52" y="44" width="28" height="22" rx="4" stroke={accent} strokeWidth={2} fill={`${accent}22`} />
      <Circle cx="92" cy="92" r="20" fill={paper} />
    </Svg>
  );
}

function BusinessArt({ accent, paper, size }: { accent: string; paper: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d="M28 52h64v48H28V52z" stroke={accent} strokeWidth={2.5} fill={`${accent}14`} />
      <Path d="M28 52l8-16h48l8 16" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" fill={`${accent}1a`} />
      <Rect x="40" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.35} />
      <Rect x="64" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.22} />
      <Circle cx="92" cy="92" r="20" fill={paper} />
    </Svg>
  );
}

function PromoArt({ accent, paper, warning, size }: { accent: string; paper: string; warning: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect x="34" y="52" width="52" height="36" rx="6" fill={accent} />
      <Rect x="34" y="44" width="52" height="14" rx="4" fill={warning} />
      <Rect x="54" y="44" width="12" height="44" fill={paper} opacity={0.9} />
      <Circle cx="92" cy="92" r="20" fill={paper} />
    </Svg>
  );
}

function CheckBadge({ success, paper, size }: { success: string; paper: string; size: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="92" cy="92" r="16" fill={success} />
        <Path
          d="M85 92l5 5 11-12"
          stroke={paper}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function PersonaArt({
  persona,
  promo,
  accent,
  paper,
  warning,
  size,
}: {
  persona: Persona;
  promo: boolean;
  accent: string;
  paper: string;
  warning: string;
  size: number;
}) {
  if (promo) return <PromoArt accent={accent} paper={paper} warning={warning} size={size} />;
  if (persona === 'agent') return <AgentArt accent={accent} paper={paper} size={size} />;
  if (persona === 'business') return <BusinessArt accent={accent} paper={paper} size={size} />;
  return <ClientArt accent={accent} paper={paper} size={size} />;
}

/** Celebratory account-created visual with pulse ring and sparkles. */
export function SignupSuccessIllustration({
  persona,
  promo = false,
  size = 148,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.88)).current;
  const ringOpacity = useRef(new Animated.Value(0.34)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
    const ring = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.14, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.1, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.9, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.32, duration: 1400, useNativeDriver: true }),
        ]),
      ])
    );
    ring.start();
    return () => ring.stop();
  }, [opacity, ringOpacity, ringScale, scale]);

  const wrap = size + 48;
  return (
    <View
      style={[styles.wrap, { width: wrap, height: wrap }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <AnimatedView
        style={[
          styles.ring,
          {
            width: size + 36,
            height: size + 36,
            borderRadius: (size + 36) / 2,
            borderColor: colors.success.main,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <AnimatedView style={{ opacity, transform: [{ scale }] }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
            <Circle cx="60" cy="60" r="54" fill={colors.success.main} opacity={0.12} />
          </Svg>
          <PersonaArt
            persona={persona}
            promo={promo}
            accent={colors.primary.main}
            paper={colors.surface}
            warning={colors.warning.main}
            size={size}
          />
          <CheckBadge success={colors.success.main} paper={colors.surface} size={size} />
        </View>
      </AnimatedView>
      <Sparkle delay={120} x={10} y={22} color={colors.warning.main} />
      <Sparkle delay={360} x={wrap - 22} y={18} color={colors.info.main} />
      <Sparkle delay={540} x={16} y={wrap - 36} color={colors.primary.main} />
      <Sparkle delay={720} x={wrap - 28} y={wrap - 32} color={colors.success.main} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
});
