import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../../contexts/ThemeContext';

export type LocationArtKind = 'store' | 'hours' | 'payout' | 'pay' | 'bell' | 'people';

type Props = { kind: LocationArtKind; size?: number };

/** Small teaching mark for one location setting. */
export function LocationOptionArt({ kind, size = 56 }: Props) {
  const { colors } = useTheme();
  const ink = colors.primary.main;
  const accent = colors.secondary.main;
  const paper = colors.surface;
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" accessibilityRole="image">
      <Circle cx="28" cy="28" r="26" fill={ink} opacity={0.1} />
      {kind === 'store' ? <StoreMark ink={ink} accent={accent} paper={paper} /> : null}
      {kind === 'hours' ? <HoursMark ink={ink} accent={accent} paper={paper} /> : null}
      {kind === 'payout' ? <PayoutMark ink={ink} accent={accent} paper={paper} /> : null}
      {kind === 'pay' ? <PayMark ink={ink} accent={accent} paper={paper} /> : null}
      {kind === 'bell' ? <BellMark ink={ink} accent={accent} paper={paper} /> : null}
      {kind === 'people' ? <PeopleMark ink={ink} accent={accent} paper={paper} /> : null}
    </Svg>
  );
}

function StoreMark({ ink, accent, paper }: MarkColors) {
  return (
    <>
      <Path d="M14 26 L28 16 L42 26" fill={ink} />
      <Rect x="16" y="26" width="24" height="16" rx="3" fill={paper} stroke={ink} strokeWidth={1.5} />
      <Rect x="25" y="32" width="6" height="10" rx="1" fill={accent} />
    </>
  );
}

function HoursMark({ ink, accent, paper }: MarkColors) {
  return (
    <>
      <Circle cx="28" cy="30" r="12" fill={paper} stroke={ink} strokeWidth={1.5} />
      <Path d="M28 30 L28 22" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M28 30 L34 33" stroke={accent} strokeWidth={1.8} strokeLinecap="round" />
    </>
  );
}

function PayoutMark({ ink, accent, paper }: MarkColors) {
  return (
    <>
      <Rect x="20" y="14" width="16" height="26" rx="3" fill={paper} stroke={ink} strokeWidth={1.5} />
      <Circle cx="28" cy="36" r="1.2" fill={ink} />
      <Circle cx="38" cy="22" r="7" fill={accent} />
      <Path d="M38 18.5 V25.5 M35.2 21 H40" stroke={paper} strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

function PayMark({ ink, accent, paper }: MarkColors) {
  return (
    <>
      <Rect x="14" y="18" width="22" height="20" rx="3" fill={paper} stroke={ink} strokeWidth={1.5} />
      <Path d="M18 24 H32 M18 28 H28" stroke={ink} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx="38" cy="34" r="8" fill={accent} />
      <Path d="M34.5 34 L37 36.5 L42 31" stroke={paper} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </>
  );
}

function BellMark({ ink, accent }: MarkColors) {
  return (
    <>
      <Path d="M28 16 C22 16 18 21 18 27 V33 L15 36 H41 L38 33 V27 C38 21 34 16 28 16 Z" fill={ink} opacity={0.9} />
      <Circle cx="28" cy="39" r="2.4" fill={accent} />
    </>
  );
}

function PeopleMark({ ink, accent }: MarkColors) {
  return (
    <>
      <Circle cx="22" cy="22" r="5" fill={ink} />
      <Path d="M12 40 C12 32 16 29 22 29 C28 29 32 32 32 40" fill={ink} opacity={0.85} />
      <Circle cx="36" cy="24" r="4" fill={accent} />
      <Path d="M28 40 C28 34 31 31 36 31 C41 31 44 34 44 40" fill={accent} opacity={0.85} />
    </>
  );
}

type MarkColors = { ink: string; accent: string; paper: string };
