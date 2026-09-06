import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { SignupStartPersona } from '../../services/publicAuthApi';

type Props = {
  persona: SignupStartPersona;
  accent: string;
  size?: number;
  /** Soft float loop for presence when the persona is selected. */
  animate?: boolean;
};

function ClientArt({ accent, size }: { accent: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="54" fill={accent} opacity={0.08} />
      <Path
        d="M38 48h44l-6 52H44L38 48z"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill={`${accent}18`}
      />
      <Path
        d="M48 48V40c0-6.6 5.4-12 12-12s12 5.4 12 12v8"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="32" cy="28" r="3" fill={accent} opacity={0.35} />
      <Circle cx="88" cy="32" r="2.5" fill={accent} opacity={0.45} />
    </Svg>
  );
}

function AgentArt({ accent, size }: { accent: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="54" fill={accent} opacity={0.08} />
      <Ellipse
        cx="40"
        cy="88"
        rx="10"
        ry="10"
        stroke={accent}
        strokeWidth={2.5}
        fill={`${accent}12`}
      />
      <Ellipse
        cx="82"
        cy="88"
        rx="10"
        ry="10"
        stroke={accent}
        strokeWidth={2.5}
        fill={`${accent}12`}
      />
      <Path
        d="M32 88h56M48 88V58h20l14 14v16"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect
        x="52"
        y="44"
        width="28"
        height="22"
        rx="4"
        stroke={accent}
        strokeWidth={2}
        fill={`${accent}22`}
      />
    </Svg>
  );
}

function BusinessArt({ accent, size }: { accent: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="54" fill={accent} opacity={0.08} />
      <Path
        d="M28 52h64v48H28V52z"
        stroke={accent}
        strokeWidth={2.5}
        fill={`${accent}14`}
      />
      <Path
        d="M28 52l8-16h48l8 16"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill={`${accent}1a`}
      />
      <Rect x="40" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.35} />
      <Rect x="64" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.22} />
      <Rect x="52" y="36" width="16" height="8" rx="2" fill={accent} opacity={0.5} />
    </Svg>
  );
}

const LABELS: Record<SignupStartPersona, string> = {
  client: 'Shop and track orders',
  agent: 'Deliver and earn',
  business: 'Sell from your storefront',
};

/** Theme-aware persona metaphor shown when a signup persona is selected. */
export function PersonaPickIllustration({
  persona,
  accent,
  size = 112,
  animate = true,
}: Props) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  let art: React.ReactNode = null;
  if (persona === 'client') art = <ClientArt accent={accent} size={size} />;
  else if (persona === 'agent') art = <AgentArt accent={accent} size={size} />;
  else art = <BusinessArt accent={accent} size={size} />;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, transform: [{ translateY }] },
      ]}
      accessibilityRole="image"
      accessibilityLabel={LABELS[persona]}
    >
      {art}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
