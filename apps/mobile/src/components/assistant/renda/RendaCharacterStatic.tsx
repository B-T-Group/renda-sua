/**
 * Static Renda drawing for the many-on-screen uses (message avatars, the header
 * button, badges): ONE <Svg> of solid fills, no Animated values, listeners or
 * effects. Same geometry as the animated character at rest; colour, accents and
 * eye shape still follow the state (Thinking reads violet with its dots).
 */
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  EYE_X,
  THINK_DOTS,
  VIEWBOX_H,
  VIEWBOX_W,
  characterWidth,
  eyeShapeFor,
  eyesForSize,
  resolveRendaConfig,
  type RendaCharacterState,
  type RendaEyes,
} from './rendaCharacterModel';
import { ArcShapes, BlobShapes, PillShape, TickShapes } from './rendaCharacterLayers';

export type RendaCharacterStaticProps = {
  size: number;
  state?: RendaCharacterState;
  eyes?: RendaEyes;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function StaticEyes({ shape }: { shape: ReturnType<typeof eyeShapeFor> }) {
  if (shape === 'none') return null;
  if (shape === 'arc') return <ArcShapes />;
  return (
    <>
      {EYE_X.map((x) => (
        <PillShape key={x} x={x} dot={shape === 'dot'} />
      ))}
    </>
  );
}

function RendaCharacterStaticImpl({ size, state = 'idle', eyes, style, testID }: RendaCharacterStaticProps) {
  const cfg = resolveRendaConfig(state, { animated: false, reducedMotion: false });
  const eyeShape = eyeShapeFor(eyes ?? eyesForSize(size), cfg);
  const color = cfg.tint > 0.5 ? T.violet : T.blue;
  const k = size / VIEWBOX_H;
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
      <Svg width={VIEWBOX_W * k} height={size} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
        <BlobShapes color={color} />
        <G transform={`translate(${ox} ${oy})`}>
          <StaticEyes shape={eyeShape} />
        </G>
        {cfg.dots
          ? THINK_DOTS.map(([cx, cy, r]) => <Circle key={cx} cx={cx} cy={cy} r={r} fill={color} />)
          : null}
        {cfg.ticks ? <TickShapes color={color} /> : null}
      </Svg>
    </View>
  );
}

export const RendaCharacterStatic = memo(RendaCharacterStaticImpl);
