import { CSSProperties, memo, useId } from 'react';
import {
  CX,
  CY,
  EYE_X,
  EYE_Y,
  RENDA_COLORS as C,
  RENDA_WIDTH_RATIO,
  RendaEyes,
  eyesForSize,
} from './rendaCharacterTokens';

export interface RendaAvatarProps {
  /** Character height in px (width is 0.82 × height). */
  size: number;
  /** Defaults to the size rule: happy arcs ≥ 36, dots 20-35, none below 20. */
  eyes?: RendaEyes;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Static Renda character for the many-on-screen slots (28 px message avatars, the
 * 28 px header button; spec #451 §1: "none (many on screen; motion in the thread is
 * noise)"). About a dozen SVG nodes: a linear gradient approximates the ring's
 * sweep (highlight top-right), a radial gradient stands in for the blurred halo,
 * and there are no filters, masks, rAF engine or listeners. A long thread therefore
 * costs a few nodes per assistant group instead of the animated character's ~270.
 */
function RendaAvatarImpl({
  size,
  eyes,
  className,
  style,
  'data-testid': testId,
}: RendaAvatarProps) {
  const eyesMode: RendaEyes = eyes ?? eyesForSize(size);
  const gid = `rendaav${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const width = +(size * RENDA_WIDTH_RATIO).toFixed(2);
  return (
    <svg
      viewBox="0 0 82 100"
      width={width}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid={testId}
      data-renda=""
      data-renda-state="idle"
      data-renda-eyes={eyesMode}
      data-renda-eye-shape={
        eyesMode === 'none' ? 'none' : eyesMode === 'dot' ? 'dot' : 'arc'
      }
      data-renda-motion="static"
      style={{
        display: 'block',
        overflow: 'visible',
        flex: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <defs>
        <linearGradient id={`${gid}r`} x1="0.9" y1="0.08" x2="0.15" y2="0.88">
          <stop offset="0" stopColor={C.tint} />
          <stop offset="0.3" stopColor={C.light} />
          <stop offset="0.6" stopColor={C.main} />
        </linearGradient>
        <radialGradient id={`${gid}h`}>
          <stop offset="0.8" stopColor={C.main} stopOpacity={0.34} />
          <stop offset="0.9" stopColor={C.main} stopOpacity={0.13} />
          <stop offset="1" stopColor={C.main} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Halo: a radial falloff instead of the animated character's blur filter. */}
      <ellipse cx={CX} cy={CY} rx={49} ry={59} fill={`url(#${gid}h)`} />
      {/* Ring as a filled oval under the face, so no seam shows between them. */}
      <ellipse cx={CX} cy={CY} rx={40.5} ry={49.5} fill={`url(#${gid}r)`} />
      <ellipse cx={CX} cy={CY} rx={33.5} ry={42.5} fill={C.navy} />
      <ellipse
        cx={CX}
        cy={CY}
        rx={32.3}
        ry={41.3}
        fill="none"
        stroke={C.navyEdge}
        strokeWidth={2.4}
      />
      {eyesMode === 'dot' &&
        EYE_X.map((x) => (
          <circle key={x} cx={x} cy={EYE_Y} r={5} fill={C.white} />
        ))}
      {eyesMode === 'expressive' &&
        EYE_X.map((x) => (
          <path
            key={x}
            d={`M${x - 6} 48Q${x} 40 ${x + 6} 48`}
            fill="none"
            stroke={C.white}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}

export const RendaAvatar = memo(RendaAvatarImpl);
export default RendaAvatar;
