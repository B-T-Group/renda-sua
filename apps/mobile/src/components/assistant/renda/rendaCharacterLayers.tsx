/**
 * Static SVG pieces of the Renda character. Each piece is its own <Svg> so the
 * parent can move it with RN core Animated (transform / opacity only, native
 * driver). Coordinates are in the spec's 0 0 82 100 viewBox.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  CX,
  CY,
  DOT_EYE_R,
  EYE_CENTERS,
  FACE,
  FACE_EDGE,
  HALO,
  OPEN_EYE,
  ARC_EYE_STROKE,
  RING,
  RING_OVERLAY_STROKE,
  VIEWBOX_H,
  VIEWBOX_W,
  arcEyePath,
  buildRingSegments,
  buildSweepSegments,
  haloColor,
} from './rendaCharacterModel';

/** Absolute frame for an SVG covering viewBox rect (x, y, w, h) at scale k px/unit. */
export function frameStyle(k: number, x: number, y: number, w: number, h: number): ViewStyle {
  return { position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k };
}

type LayerProps = { k: number };

/** Viewbox rect padded by `pad` units on every side, centred on the character. */
function padded(pad: number) {
  return { x: -pad, y: -pad, w: VIEWBOX_W + pad * 2, h: VIEWBOX_H + pad * 2 };
}

function PaddedSvg({ k, pad, children }: LayerProps & { pad: number; children: React.ReactNode }) {
  const r = padded(pad);
  return (
    <Svg
      style={frameStyle(k, r.x, r.y, r.w, r.h)}
      width={r.w * k}
      height={r.h * k}
      viewBox={`${r.x} ${r.y} ${r.w} ${r.h}`}
    >
      {children}
    </Svg>
  );
}

const HALO_PAD = 32;

/** Soft oval halo (blur replaced by a radial falloff; no SVG filters on native). */
export const HaloLayer = memo(function HaloLayer({ k, dark, id }: LayerProps & { dark: boolean; id: string }) {
  const color = haloColor(dark);
  const spread = 10;
  return (
    <PaddedSvg k={k} pad={HALO_PAD}>
      <Defs>
        <RadialGradient id={`${id}h`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset={(HALO.ry - spread) / (HALO.ry + spread)} stopColor={color} stopOpacity={1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        {dark ? (
          <RadialGradient id={`${id}hw`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={T.ringLight} stopOpacity={0.55} />
            <Stop offset="0.45" stopColor={T.ringLight} stopOpacity={0.55} />
            <Stop offset="1" stopColor={T.ringLight} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      {dark ? <Ellipse cx={CX} cy={CY} rx={70} ry={82} fill={`url(#${id}hw)`} /> : null}
      <Ellipse cx={CX} cy={CY} rx={HALO.rx + spread} ry={HALO.ry + spread} fill={`url(#${id}h)`} />
    </PaddedSvg>
  );
});

/** Glow band hugging the ring (the prototype's blurred "bloom"). */
export const BloomLayer = memo(function BloomLayer({ k, id }: LayerProps & { id: string }) {
  const s = 1.25;
  return (
    <PaddedSvg k={k} pad={14}>
      <Defs>
        <RadialGradient id={`${id}b`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0.66" stopColor={T.ringLight} stopOpacity={0} />
          <Stop offset={1 / s} stopColor={T.ringLight} stopOpacity={1} />
          <Stop offset="0.95" stopColor={T.ringLight} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={CX} cy={CY} rx={RING.rx * s} ry={RING.ry * s} fill={`url(#${id}b)`} />
    </PaddedSvg>
  );
});

/** Exact 7-wide ring + faint outer line, under the rotating gradient overlay. */
export const RingBaseLayer = memo(function RingBaseLayer({ k, id }: LayerProps & { id: string }) {
  return (
    <PaddedSvg k={k} pad={4}>
      <Defs>
        <LinearGradient id={`${id}rb`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={T.ringMain} />
          <Stop offset="1" stopColor={T.ringLight} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={CX} cy={CY} rx={RING.rx} ry={RING.ry} fill="none" stroke={`url(#${id}rb)`} strokeWidth={RING.stroke} />
      <Ellipse
        cx={CX}
        cy={CY}
        rx={40.1}
        ry={49.1}
        fill="none"
        stroke={T.ringHighlight}
        strokeOpacity={0.28}
        strokeWidth={0.7}
      />
    </PaddedSvg>
  );
});

/** Circle-space square (centred on CX, CY) that holds the rotating overlays. */
export const RING_SQUARE = (() => {
  const half = RING.ry + RING_OVERLAY_STROKE / 2 + 1;
  return { x: CX - half, y: CY - half, size: half * 2 };
})();

function CircleSquareSvg({ k, children }: LayerProps & { children: React.ReactNode }) {
  const q = RING_SQUARE;
  return (
    <Svg width={q.size * k} height={q.size * k} viewBox={`${q.x} ${q.y} ${q.size} ${q.size}`}>
      {children}
    </Svg>
  );
}

/** Sweep gradient as annulus segments on a circle (r 46); parent squashes x to 37/46. */
export const RingGradientCircle = memo(function RingGradientCircle({ k, segments }: LayerProps & { segments: number }) {
  const paths = useMemo(
    () => buildRingSegments(segments, CX, CY, RING.ry, RING_OVERLAY_STROKE),
    [segments]
  );
  return (
    <CircleSquareSvg k={k}>
      {paths.map((w, i) => (
        <Path key={i} d={w.d} fill={w.fill} />
      ))}
    </CircleSquareSvg>
  );
});

/** Responding highlight comet on the same circle. */
export const RingSweepCircle = memo(function RingSweepCircle({ k }: LayerProps) {
  const paths = useMemo(() => buildSweepSegments(CX, CY, RING.ry, RING_OVERLAY_STROKE - 0.6), []);
  return (
    <CircleSquareSvg k={k}>
      {paths.map((w, i) => (
        <Path key={i} d={w.d} fill={w.fill} fillOpacity={w.opacity} />
      ))}
    </CircleSquareSvg>
  );
});

/** Navy face with a radial inner shade (to 12% black) and a thin rim line. */
export const FaceLayer = memo(function FaceLayer({ k, id }: LayerProps & { id: string }) {
  return (
    <PaddedSvg k={k} pad={0}>
      <Defs>
        <RadialGradient id={`${id}f`} cx="50%" cy="46%" r="54%">
          <Stop offset="0" stopColor={T.face} />
          <Stop offset="0.62" stopColor={T.face} />
          <Stop offset="1" stopColor={FACE_EDGE} />
        </RadialGradient>
      </Defs>
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
    </PaddedSvg>
  );
});

/** One orbit swirl: a comet-stroked circle (r 52) in its own square. */
export const ORBIT_R = 52;
export const OrbitCircle = memo(function OrbitCircle({ k, dark, id }: LayerProps & { dark: boolean; id: string }) {
  const half = ORBIT_R + 3;
  return (
    <Svg width={half * 2 * k} height={half * 2 * k} viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}>
      <Defs>
        <LinearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={T.ringLight} stopOpacity={0} />
          <Stop offset="0.55" stopColor={T.ringLight} stopOpacity={0.22} />
          <Stop offset="1" stopColor={T.ringLight} stopOpacity={0.6} />
        </LinearGradient>
        {dark ? (
          <LinearGradient id={`${id}o2`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={T.ringHighlight} stopOpacity={0} />
            <Stop offset="1" stopColor={T.ringHighlight} stopOpacity={0.9} />
          </LinearGradient>
        ) : null}
      </Defs>
      {dark ? (
        <Circle r={ORBIT_R} fill="none" stroke={`url(#${id}o2)`} strokeWidth={3.5} opacity={0.3} />
      ) : null}
      {/* 2 units: ~1.5 on average once the frame squashes y to 0.44. */}
      <Circle r={ORBIT_R} fill="none" stroke={`url(#${id}o)`} strokeWidth={2} />
    </Svg>
  );
});

/** Drift echoes (thinking): slightly offset ring ghosts. */
export const ECHO_DEFS: readonly { cx: number; cy: number; rx: number; ry: number; tint: boolean; w: number }[] = [
  { cx: 42.4, cy: 49.0, rx: 38.6, ry: 47.6, tint: false, w: 1.2 },
  { cx: 39.6, cy: 51.3, rx: 39.4, ry: 46.8, tint: true, w: 0.9 },
  { cx: 41.0, cy: 48.4, rx: 40.2, ry: 49.0, tint: false, w: 0.8 },
];

export const EchoEllipse = memo(function EchoEllipse({ k, index }: LayerProps & { index: number }) {
  const e = ECHO_DEFS[index];
  return (
    <PaddedSvg k={k} pad={6}>
      <Ellipse
        cx={e.cx}
        cy={e.cy}
        rx={e.rx}
        ry={e.ry}
        fill="none"
        stroke={e.tint ? T.ringHighlight : T.ringLight}
        strokeWidth={e.w}
      />
    </PaddedSvg>
  );
});

/** Happy arcs for both eyes. */
export const ArcEyes = memo(function ArcEyes({ k }: LayerProps) {
  return (
    <PaddedSvg k={k} pad={0}>
      {EYE_CENTERS.map(([x, y]) => (
        <Path
          key={x}
          d={arcEyePath(x, y)}
          fill="none"
          stroke={T.eye}
          strokeWidth={ARC_EYE_STROKE}
          strokeLinecap="round"
        />
      ))}
    </PaddedSvg>
  );
});

/** Box (viewBox units) around one open eye so scaleY pivots on the eye centre. */
export function openEyeBox(x: number, y: number) {
  return { x: x - OPEN_EYE.rx - 1, y: y - OPEN_EYE.ry - 1, w: OPEN_EYE.rx * 2 + 2, h: OPEN_EYE.ry * 2 + 2 };
}

export const OpenEye = memo(function OpenEye({ k, x, y }: LayerProps & { x: number; y: number }) {
  const b = openEyeBox(x, y);
  return (
    <Svg width={b.w * k} height={b.h * k} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}>
      <Ellipse cx={x} cy={y} rx={OPEN_EYE.rx} ry={OPEN_EYE.ry} fill={T.eye} />
    </Svg>
  );
});

export const DotEyes = memo(function DotEyes({ k }: LayerProps) {
  return (
    <PaddedSvg k={k} pad={0}>
      {EYE_CENTERS.map(([x, y]) => (
        <Circle key={x} cx={x} cy={y} r={DOT_EYE_R} fill={T.eye} />
      ))}
    </PaddedSvg>
  );
});

/** Dark mode: soft tint glow behind the eyes (prototype eye drop-shadow). */
export const EyeGlow = memo(function EyeGlow({ k, id }: LayerProps & { id: string }) {
  return (
    <PaddedSvg k={k} pad={0}>
      <Defs>
        <RadialGradient id={`${id}eg`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.35" stopColor={T.ringHighlight} stopOpacity={0.55} />
          <Stop offset="1" stopColor={T.ringHighlight} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {EYE_CENTERS.map(([x, y]) => (
        <Ellipse key={x} cx={x} cy={y} rx={9} ry={10} fill={`url(#${id}eg)`} />
      ))}
    </PaddedSvg>
  );
});

/** Oval ripple ring for the attention cue. */
export const RippleOval = memo(function RippleOval({ k, dark }: LayerProps & { dark: boolean }) {
  return (
    <PaddedSvg k={k} pad={4}>
      <Ellipse
        cx={CX}
        cy={CY}
        rx={RING.rx}
        ry={RING.ry}
        fill="none"
        stroke={dark ? T.ringHighlight : T.ringLight}
        strokeWidth={4.5}
      />
    </PaddedSvg>
  );
});

/** 4 px diamond sparkle with a faint glow; drawn in a box `d` units tall. */
export const Sparkle = memo(function Sparkle({ px, color }: { px: number; color: string }) {
  return (
    <Svg width={px} height={px} viewBox="-2.2 -2.2 4.4 4.4">
      <Path d="M0 -2.1L1.47 0L0 2.1L-1.47 0Z" fill={color} opacity={0.28} />
      <Path d="M0 -1L0.7 0L0 1L-0.7 0Z" fill={color} />
    </Svg>
  );
});

export const layerStyles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'visible' },
});
