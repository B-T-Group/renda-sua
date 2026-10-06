/**
 * Static Renda drawing for the many-on-screen uses (#451 spec §1: message
 * avatars, the 28 px header button, badges): ONE <Svg>, no Animated values,
 * no AppState / AccessibilityInfo listeners, no effects. Same geometry and
 * colours as the animated character at rest (halo at its mid level).
 */
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  ARC_EYE_STROKE,
  BLOOM_RADIUS,
  CX,
  CY,
  DOT_EYE_R,
  EYE_CENTERS,
  FACE,
  FACE_EDGE,
  OPEN_EYE,
  RING,
  RING_OUTER,
  RING_OVERLAY_STROKE,
  RING_SQUASH_X,
  VIEWBOX_H,
  VIEWBOX_W,
  arcEyePath,
  bloomAlphaRange,
  bloomStops,
  buildRingSegments,
  characterWidth,
  eyeShapeFor,
  eyesForSize,
  haloAlphaRange,
  resolveRendaConfig,
  staticWedgeCountForSize,
  type RendaCharacterState,
  type RendaEyes,
} from './rendaCharacterModel';
import { HaloShapes, haloPad } from './rendaCharacterLayers';

export type RendaCharacterStaticProps = {
  size: number;
  state?: RendaCharacterState;
  eyes?: RendaEyes;
  dark: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

let staticSeq = 0;
const BLOOM_STOPS = bloomStops(8);
/** x-squash about CX: maps the r 46 circle onto the 37 × 46 ring. */
const SQUASH = `matrix(${RING_SQUASH_X} 0 0 1 ${CX * (1 - RING_SQUASH_X)} 0)`;

function RendaCharacterStaticImpl({ size, state = 'idle', eyes, dark, style, testID }: RendaCharacterStaticProps) {
  const id = useMemo(() => `rs${++staticSeq}`, []);
  const cfg = resolveRendaConfig(state, { animated: false, reducedMotion: false });
  const eyeShape = eyeShapeFor(eyes ?? eyesForSize(size), cfg);
  const segments = staticWedgeCountForSize(size);
  const ring = useMemo(
    () => buildRingSegments(segments, CX, CY, RING.ry, RING_OVERLAY_STROKE),
    [segments]
  );
  const pad = haloPad(dark);
  const k = size / VIEWBOX_H;
  const [hMin, hMax] = haloAlphaRange(dark);
  const [bMin, bMax] = bloomAlphaRange(dark);
  const level = cfg.halo === 'max' ? 1 : 0.5;
  const [ox, oy] = cfg.offset;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ width: characterWidth(size), height: size, overflow: 'visible' }, style]}
    >
      <Svg
        style={{ position: 'absolute', left: -pad * k, top: -pad * k }}
        width={(VIEWBOX_W + pad * 2) * k}
        height={(VIEWBOX_H + pad * 2) * k}
        viewBox={`${-pad} ${-pad} ${VIEWBOX_W + pad * 2} ${VIEWBOX_H + pad * 2}`}
      >
        <G opacity={hMin + (hMax - hMin) * level}>
          <HaloShapes dark={dark} id={id} />
        </G>
        <Defs>
          <RadialGradient id={`${id}b`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={BLOOM_RADIUS}>
            {BLOOM_STOPS.map((st, i) => (
              <Stop key={i} offset={st.offset} stopColor={T.ringLight} stopOpacity={st.opacity} />
            ))}
          </RadialGradient>
          <RadialGradient id={`${id}f`} cx="50%" cy="46%" r="54%">
            <Stop offset="0" stopColor={T.face} />
            <Stop offset="0.62" stopColor={T.face} />
            <Stop offset="1" stopColor={FACE_EDGE} />
          </RadialGradient>
        </Defs>
        <G transform={SQUASH}>
          <Circle cx={CX} cy={CY} r={BLOOM_RADIUS} fill={`url(#${id}b)`} opacity={bMin + (bMax - bMin) * level} />
        </G>
        {/* Filled to the ring's outer edge so no seam shows between ring and face. */}
        <Ellipse cx={CX} cy={CY} rx={RING_OUTER.rx} ry={RING_OUTER.ry} fill={T.ringMain} />
        <G transform={SQUASH}>
          {ring.map((w, i) => (
            <Path key={i} d={w.d} fill={w.fill} />
          ))}
        </G>
        <Ellipse cx={CX} cy={CY} rx={FACE.rx} ry={FACE.ry} fill={`url(#${id}f)`} />
        <Ellipse
          cx={CX}
          cy={CY}
          rx={FACE.rx + 0.1}
          ry={FACE.ry + 0.1}
          fill="none"
          stroke="#000000"
          strokeOpacity={0.18}
          strokeWidth={0.8}
        />
        {eyeShape === 'none' ? null : (
          <G transform={`translate(${ox} ${oy})`}>
            {EYE_CENTERS.map(([x, y]) =>
              eyeShape === 'dot' ? (
                <Circle key={x} cx={x} cy={y} r={DOT_EYE_R} fill={T.eye} />
              ) : eyeShape === 'open' ? (
                <Ellipse key={x} cx={x} cy={y} rx={OPEN_EYE.rx} ry={OPEN_EYE.ry} fill={T.eye} />
              ) : (
                <Path
                  key={x}
                  d={arcEyePath(x, y)}
                  fill="none"
                  stroke={T.eye}
                  strokeWidth={ARC_EYE_STROKE}
                  strokeLinecap="round"
                />
              )
            )}
          </G>
        )}
      </Svg>
    </View>
  );
}

export const RendaCharacterStatic = memo(RendaCharacterStaticImpl);
