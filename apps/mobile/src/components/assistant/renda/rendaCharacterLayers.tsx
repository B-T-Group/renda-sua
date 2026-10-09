/**
 * Static SVG pieces of the Renda character. Each moving piece is its own <Svg>
 * so the parent can move it with RN core Animated (transform / opacity only,
 * native driver). Solid fills only: no gradients, masks or filters, so each
 * layer rasterises once. Coordinates are in the 0 0 82 100 viewBox.
 */
import { memo, type ComponentProps } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  ARC_EYE_STROKE,
  BLOB,
  BLOB_PATH,
  EYE_DOT,
  EYE_PILL,
  EYE_X,
  EYE_Y,
  SHADOW,
  THINK_DOTS,
  TICKS,
  TICK_PIVOT,
  VIEWBOX_H,
  VIEWBOX_W,
  arcEyePath,
} from './rendaCharacterModel';

/** Absolute frame for an SVG covering viewBox rect (x, y, w, h) at scale k px/unit. */
export function frameStyle(k: number, x: number, y: number, w: number, h: number): ViewStyle {
  return { position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k };
}

type LayerProps = { k: number };
type Box = { x: number; y: number; w: number; h: number };

/**
 * SVG of viewBox rect `b` that fills its parent. The parent is what gets placed
 * at `b` (see `frameStyle`); this SVG stays at the parent's origin. Putting
 * `left`/`top` here as well shifts the layer by `b` a second time.
 */
function BoxSvg({ k, b, children }: LayerProps & { b: Box; children: ComponentProps<typeof Svg>['children'] }) {
  return (
    <Svg
      style={frameStyle(k, 0, 0, b.w, b.h)}
      width={b.w * k}
      height={b.h * k}
      viewBox={`0 0 ${b.w} ${b.h}`}
    >
      <G transform={`translate(${-b.x}, ${-b.y})`}>{children}</G>
    </Svg>
  );
}

/** Square box of half-size `half` centred on (cx, cy): native transforms pivot on it. */
export const centredBox = (cx: number, cy: number, half: number): Box => ({
  x: cx - half,
  y: cy - half,
  w: half * 2,
  h: half * 2,
});

const FULL: Box = { x: 0, y: 0, w: VIEWBOX_W, h: VIEWBOX_H };

/** Blob body + flat highlight (no <Svg>; shared with the static drawing). */
export function BlobShapes({ color }: { color: string }) {
  return (
    <>
      <Path d={BLOB_PATH} fill={color} />
      <G fill={T.highlight}>
        <Ellipse cx={19} cy={42} rx={7.5} ry={3.8} opacity={0.3} transform="rotate(-38 19 42)" />
        <Circle cx={27.5} cy={35.5} r={1.8} opacity={0.45} />
      </G>
    </>
  );
}

export const BlobLayer = memo(function BlobLayer({ k, color }: LayerProps & { color: string }) {
  return (
    <BoxSvg k={k} b={FULL}>
      <BlobShapes color={color} />
    </BoxSvg>
  );
});

export const SHADOW_BOX = centredBox(SHADOW.cx, SHADOW.cy, SHADOW.rx + 1);

/** Flat ground shadow in the body colour; the parent scales it as the blob lifts. */
export const ShadowLayer = memo(function ShadowLayer({ k, color }: LayerProps & { color: string }) {
  return (
    <BoxSvg k={k} b={SHADOW_BOX}>
      <Ellipse cx={SHADOW.cx} cy={SHADOW.cy} rx={SHADOW.rx} ry={SHADOW.ry} fill={color} />
    </BoxSvg>
  );
});

/** Pill eye (no <Svg>) centred on (x, EYE_Y). */
export function PillShape({ x, dot }: { x: number; dot?: boolean }) {
  const [w, h] = dot ? EYE_DOT : EYE_PILL;
  return <Rect x={x - w / 2} y={EYE_Y - h / 2} width={w} height={h} rx={w / 2} fill={T.eye} />;
}

/** Box around one eye: the parent's scaleY (blink / openness) pivots on its centre. */
export const eyeBox = (x: number) => centredBox(x, EYE_Y, 7.5);

export const PillEye = memo(function PillEye({ k, x, dot }: LayerProps & { x: number; dot?: boolean }) {
  return (
    <BoxSvg k={k} b={eyeBox(x)}>
      <PillShape x={x} dot={dot} />
    </BoxSvg>
  );
});

export function ArcShapes() {
  return (
    <>
      {EYE_X.map((x) => (
        <Path
          key={x}
          d={arcEyePath(x)}
          fill="none"
          stroke={T.eye}
          strokeWidth={ARC_EYE_STROKE}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

export const ArcEyes = memo(function ArcEyes({ k }: LayerProps) {
  return (
    <BoxSvg k={k} b={FULL}>
      <ArcShapes />
    </BoxSvg>
  );
});

export const dotBox = (i: number) => centredBox(THINK_DOTS[i][0], THINK_DOTS[i][1], 4);

/** One thinking dot, in a box centred on it so it scales in place. */
export const ThinkDot = memo(function ThinkDot({ k, i, color }: LayerProps & { i: number; color: string }) {
  const [cx, cy, r] = THINK_DOTS[i];
  return (
    <BoxSvg k={k} b={dotBox(i)}>
      <Circle cx={cx} cy={cy} r={r} fill={color} />
    </BoxSvg>
  );
});

export function TickShapes({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={2.6} strokeLinecap="round">
      {TICKS.map(([x1, y1, x2, y2]) => (
        <Line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </G>
  );
}

export const TICK_BOX = centredBox(TICK_PIVOT[0], TICK_PIVOT[1], 14);

/** Listening / responding signal ticks, centred on their pulse pivot. */
export const Ticks = memo(function Ticks({ k, color }: LayerProps & { color: string }) {
  return (
    <BoxSvg k={k} b={TICK_BOX}>
      <TickShapes color={color} />
    </BoxSvg>
  );
});

export const RIPPLE_BOX = centredBox(BLOB.cx, BLOB.cy, 50);

/** Ripple: the blob outline, in a box centred on the blob so it scales outward. */
export const RippleBlob = memo(function RippleBlob({ k, color }: LayerProps & { color: string }) {
  return (
    <BoxSvg k={k} b={RIPPLE_BOX}>
      <Path d={BLOB_PATH} fill="none" stroke={color} strokeWidth={1.6} />
    </BoxSvg>
  );
});

/** Success mote: a small solid dot `px` wide. */
export const Mote = memo(function Mote({ px }: { px: number }) {
  return (
    <Svg width={px} height={px} viewBox="0 0 10 10">
      <Circle cx={5} cy={5} r={5} fill={T.mote} />
    </Svg>
  );
});

export const layerStyles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'visible' },
});

/** Empty-state hero disc: a flat, faint body-colour circle behind the hero. */
export const StageDisc = memo(function StageDisc({ diameter, dark }: { diameter: number; dark: boolean }) {
  return (
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100" pointerEvents="none">
      <Circle cx={50} cy={50} r={50} fill={T.blue} fillOpacity={dark ? 0.1 : 0.06} />
    </Svg>
  );
});
