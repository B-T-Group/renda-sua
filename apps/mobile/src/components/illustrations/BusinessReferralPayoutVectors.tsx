import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

type Props = { size?: number };

function ArtFrame({
  size,
  label,
  children,
}: {
  size: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {children}
      </Svg>
    </View>
  );
}

/** 10 approved products plus a completed sale. */
export function Catalog10PayoutVector({ size = 96 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;
  return (
    <ArtFrame size={size} label="Ten products and a sale">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      <Rect x="22" y="38" width="48" height="44" rx="8" fill={primary} />
      <Path d="M22 50 H70" stroke={paper} strokeWidth={2} opacity={0.4} />
      <Rect x="30" y="58" width="12" height="14" rx="2" fill={paper} />
      <Rect x="46" y="58" width="12" height="14" rx="2" fill={paper} opacity={0.7} />
      <Circle cx="90" cy="62" r="16" fill={success} />
      <Path d="M90 54 V70 M82 62 H98" stroke={paper} strokeWidth={2.4} strokeLinecap="round" />
    </ArtFrame>
  );
}

/** 1% of every completed sale. */
export function SalePercentPayoutVector({ size = 96 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const success = colors.success.main;
  const paper = colors.surface;
  return (
    <ArtFrame size={size} label="One percent of every sale">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.08} />
      <Circle cx="60" cy="60" r="28" fill={success} />
      <SvgText
        x="60"
        y="68"
        fill={paper}
        fontSize="22"
        fontWeight="700"
        textAnchor="middle"
      >
        1%
      </SvgText>
    </ArtFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
