import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

type Props = { size?: number };

/** Handshake / approach a business owner. */
export function RecruitmentApproachVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Approach a business"
    >
      <Svg width={size} height={size} viewBox="0 0 112 112">
        <Circle cx="56" cy="56" r="52" fill={primary} opacity={0.08} />
        <Circle cx="38" cy="40" r="12" fill={primary} />
        <Circle cx="74" cy="40" r="12" fill={primary} opacity={0.75} />
        <Path
          d="M22 78 C22 62 48 62 56 72 C64 62 90 62 90 78"
          fill={primary}
          opacity={0.85}
        />
        <Rect x="48" y="66" width="16" height="10" rx="3" fill={paper} />
      </Svg>
    </View>
  );
}

/** Benefits pitch — storefront + customers. */
export function RecruitmentBenefitsVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Business benefits"
    >
      <Svg width={size} height={size} viewBox="0 0 112 112">
        <Circle cx="56" cy="56" r="52" fill={success} opacity={0.1} />
        <Rect x="30" y="36" width="52" height="42" rx="8" fill={primary} />
        <Path d="M30 48 H82" stroke={paper} strokeWidth={2} opacity={0.4} />
        <Rect x="40" y="56" width="14" height="14" rx="2" fill={paper} opacity={0.9} />
        <Circle cx="78" cy="78" r="14" fill={success} />
        <Path
          d="M72 78 L76 82 L86 72"
          stroke={paper}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** What to say — speech bubble. */
export function RecruitmentPitchVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="What to say"
    >
      <Svg width={size} height={size} viewBox="0 0 112 112">
        <Circle cx="56" cy="56" r="52" fill={primary} opacity={0.08} />
        <Path
          d="M28 34 H84 A10 10 0 0 1 94 44 V66 A10 10 0 0 1 84 76 H52 L40 90 V76 H28 A10 10 0 0 1 18 66 V44 A10 10 0 0 1 28 34 Z"
          fill={primary}
        />
        <Path
          d="M36 50 H76 M36 60 H64"
          stroke={paper}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
