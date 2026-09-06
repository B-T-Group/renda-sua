import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { BUSINESS_ACCOUNT_TYPE_PLANS } from '../../types/business/accountType';

type Props = { size?: number };

/** Three ascending bar columns representing Standard, Premium, Elite tiers. */
export function AccountTypeTiersVector({ size = 120 }: Props) {
  const [standard, premium, elite] = BUSINESS_ACCOUNT_TYPE_PLANS;
  const scale = size / 120;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Three business tiers — Standard, Premium, Elite"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Rect x={8} y={72} width={28} height={36} rx={4} fill={standard.color} opacity={0.55} />
        <Rect x={46} y={50} width={28} height={58} rx={4} fill={premium.color} opacity={0.85} />
        <Rect x={84} y={20} width={28} height={88} rx={4} fill={elite.color} />

        <SvgText x={22} y={68} textAnchor="middle" fontSize={14 * scale} fill={standard.color}>
          ★
        </SvgText>
        <SvgText x={60} y={46} textAnchor="middle" fontSize={11 * scale} fill={premium.color}>
          ★★
        </SvgText>
        <SvgText x={98} y={16} textAnchor="middle" fontSize={9 * scale} fill={elite.color}>
          ★★★
        </SvgText>

        <SvgText x={22} y={116} textAnchor="middle" fontSize={8 * scale} fill={standard.color}>
          12%
        </SvgText>
        <SvgText x={60} y={116} textAnchor="middle" fontSize={8 * scale} fill={premium.color}>
          15%
        </SvgText>
        <SvgText x={98} y={116} textAnchor="middle" fontSize={8 * scale} fill={elite.color}>
          20%
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
