import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import type { JourneyIllustrationId } from '../../utils/clientOrderJourney';

type Props = { size?: number };

function Frame({
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

export function OrderJourneyReceivedVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;
  return (
    <Frame size={size} label="Order received">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.1} />
      <Rect x="28" y="42" width="64" height="44" rx="8" fill={primary} />
      <Path d="M28 54 H92" stroke={paper} strokeWidth={2} opacity={0.35} />
      <Rect x="40" y="62" width="28" height="6" rx="3" fill={paper} opacity={0.7} />
      <Rect x="40" y="74" width="40" height="6" rx="3" fill={paper} opacity={0.45} />
    </Frame>
  );
}

export function OrderJourneyPreparingVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;
  return (
    <Frame size={size} label="Order being prepared">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.1} />
      <Rect x="34" y="38" width="52" height="40" rx="8" fill={primary} />
      <Path
        d="M42 78 H78"
        stroke={secondary}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Circle cx="78" cy="48" r="14" fill={secondary} />
      <Path
        d="M72 48 H84 M78 42 V54"
        stroke={colors.surface}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function OrderJourneyPickupVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const paper = colors.surface;
  return (
    <Frame size={size} label="Ready for store pickup">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.1} />
      <Path d="M24 72 L60 40 L96 72 Z" fill={primary} opacity={0.9} />
      <Rect x="34" y="72" width="52" height="28" rx="4" fill={primary} />
      <Rect x="52" y="80" width="16" height="20" rx="2" fill={paper} opacity={0.85} />
    </Frame>
  );
}

export function OrderJourneyCourierVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const secondary = colors.secondary.main;
  return (
    <Frame size={size} label="Delivery agent on the way">
      <Circle cx="60" cy="60" r="54" fill={primary} opacity={0.1} />
      <Circle cx="48" cy="46" r="12" fill={primary} />
      <Path d="M30 78 C30 62 66 62 66 78" fill={primary} opacity={0.9} />
      <Circle cx="86" cy="70" r="16" fill={secondary} />
      <Path
        d="M80 70 H92 M86 64 V76"
        stroke={colors.surface}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function OrderJourneyPinVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const primary = colors.primary.main;
  const warning = colors.warning.main;
  const paper = colors.surface;
  return (
    <Frame size={size} label="Send delivery PIN">
      <Circle cx="60" cy="60" r="54" fill={warning} opacity={0.12} />
      <Rect x="38" y="48" width="44" height="36" rx="8" fill={primary} />
      <Path
        d="M48 48 V40 C48 32 72 32 72 40 V48"
        stroke={primary}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx="60" cy="64" r="5" fill={paper} />
      <Rect x="57" y="68" width="6" height="8" rx="2" fill={paper} />
    </Frame>
  );
}

export function OrderJourneyDeliveredVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const success = colors.success.main;
  const paper = colors.surface;
  return (
    <Frame size={size} label="Order delivered">
      <Circle cx="60" cy="60" r="54" fill={success} opacity={0.12} />
      <Circle cx="60" cy="60" r="28" fill={success} />
      <Path
        d="M46 60 L56 70 L76 48"
        stroke={paper}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Frame>
  );
}

export function OrderJourneyCancelledVector({ size = 112 }: Props) {
  const { colors } = useTheme();
  const error = colors.error.main;
  const paper = colors.surface;
  return (
    <Frame size={size} label="Order cancelled">
      <Circle cx="60" cy="60" r="54" fill={error} opacity={0.1} />
      <Circle cx="60" cy="60" r="28" fill={error} />
      <Path
        d="M48 48 L72 72 M72 48 L48 72"
        stroke={paper}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function OrderJourneyIllustration({
  id,
  size = 112,
}: {
  id: JourneyIllustrationId;
  size?: number;
}) {
  switch (id) {
    case 'preparing':
      return <OrderJourneyPreparingVector size={size} />;
    case 'pickupReady':
      return <OrderJourneyPickupVector size={size} />;
    case 'courier':
      return <OrderJourneyCourierVector size={size} />;
    case 'pin':
      return <OrderJourneyPinVector size={size} />;
    case 'delivered':
      return <OrderJourneyDeliveredVector size={size} />;
    case 'cancelled':
      return <OrderJourneyCancelledVector size={size} />;
    case 'received':
    default:
      return <OrderJourneyReceivedVector size={size} />;
  }
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
});
