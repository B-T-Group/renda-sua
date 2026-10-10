import { CSSProperties, memo } from 'react';
import {
  EYE_DOT,
  EYE_PILL,
  EYE_X,
  EYE_Y,
  RENDA_COLORS as C,
  RENDA_REST_PATH,
  RENDA_WIDTH_RATIO,
  RendaEyes,
  eyesForSize,
} from './rendaCharacterTokens';

export interface RendaAvatarProps {
  /** Character height in px (width is 0.82 × height). */
  size: number;
  /** Defaults to the size rule: pill eyes ≥ 36, dots 20-35, none below 20. */
  eyes?: RendaEyes;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/**
 * Static Renda character for the many-on-screen slots (28 px message avatars; spec
 * #451 §1: "none (many on screen; motion in the thread is noise)"). A handful of
 * solid-fill nodes: the blob, its highlight and the eyes, with no gradients,
 * filters, clip paths, rAF engine or listeners.
 */
function RendaAvatarImpl({
  size,
  eyes,
  className,
  style,
  'data-testid': testId,
}: RendaAvatarProps) {
  const eyesMode: RendaEyes = eyes ?? eyesForSize(size);
  const width = +(size * RENDA_WIDTH_RATIO).toFixed(2);
  const [w, h] = eyesMode === 'dot' ? EYE_DOT : EYE_PILL;
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
        eyesMode === 'none' ? 'none' : eyesMode === 'dot' ? 'dot' : 'open'
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
      <path d={RENDA_REST_PATH} fill={C.blue} />
      <ellipse
        cx={19}
        cy={42}
        rx={7.5}
        ry={3.8}
        fill={C.highlight}
        opacity={0.3}
        transform="rotate(-38 19 42)"
      />
      {eyesMode !== 'none' &&
        EYE_X.map((x) => (
          <rect
            key={x}
            x={x - w / 2}
            y={EYE_Y - h / 2}
            width={w}
            height={h}
            rx={w / 2}
            fill={C.eye}
          />
        ))}
    </svg>
  );
}

export const RendaAvatar = memo(RendaAvatarImpl);
export default RendaAvatar;
