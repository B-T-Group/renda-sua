import {
  CSSProperties,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  ARC_STROKE,
  CX,
  EYE_DOT,
  EYE_PILL,
  EYE_X,
  EYE_Y,
  RENDA_COLORS as C,
  RENDA_REST_PATH,
  RENDA_WIDTH_RATIO,
  RendaEngine,
  RendaEyes,
  RendaNodes,
  RendaSurface,
  RendaState,
  SPARK_ANGLES,
  THINK_DOTS,
  TICKS,
  eyeArcPath,
  eyeShapeFor,
  eyesForSize,
} from './rendaCharacterEngine';
import { msSinceInteraction, onInteraction } from './interactionClock';
import { RendaAvatar } from './RendaAvatar';
import { RendaGaze } from './rendaGaze';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type { RendaEyes, RendaSurface, RendaState } from './rendaCharacterEngine';
export { eyesForSize } from './rendaCharacterEngine';

export interface RendaCharacterProps {
  /** Character height in px (width is 0.82 × height). */
  size: number;
  state?: RendaState;
  /** False = static character (message avatars); the eye shape still follows `state`. */
  animated?: boolean;
  /** Defaults to the size rule: expressive ≥ 36, dots 20-35, none below 20. */
  eyes?: RendaEyes;
  /** Spec "Where" column: header idle is gentle, avatars never move, hero/launcher settle. */
  surface?: RendaSurface;
  /**
   * Review / harness only: freeze the Idle eye life cycle on one phase
   * (Rest / Wake / Glance / Blink / Drowse).
   */
  idleEyeForce?: {
    phase: import('./rendaIdleEyeLife').IdleEyePhase;
    glance?: import('./rendaIdleEyeLife').GlanceDir;
    blinkProgress?: number;
  };
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

function Eyes({ mode }: { mode: RendaEyes }) {
  if (mode === 'none') return null;
  const [w, h] = mode === 'dot' ? EYE_DOT : EYE_PILL;
  return (
    <g fill={C.eye}>
      {EYE_X.map((x) => (
        <g key={x} data-r="eye" data-x={x}>
          <rect data-r="open" x={x - w / 2} y={EYE_Y - h / 2} width={w} height={h} rx={w / 2} />
          {mode === 'expressive' && (
            <path
              data-r="arc"
              d={eyeArcPath(x)}
              fill="none"
              stroke={C.eye}
              strokeWidth={ARC_STROKE}
              strokeLinecap="round"
              opacity={0}
            />
          )}
        </g>
      ))}
    </g>
  );
}

/** Thinking dots and the listening / responding signal ticks (top-right, outside the body). */
function Accents() {
  return (
    <>
      <g data-r="dots" opacity={0}>
        {THINK_DOTS.map(([cx, cy, r]) => (
          <circle key={cx} data-r="dot" cx={cx} cy={cy} r={r} fill={C.blue} />
        ))}
      </g>
      <g data-r="ticks" opacity={0} stroke={C.blue} strokeWidth={2.6} strokeLinecap="round">
        {TICKS.map(([x1, y1, x2, y2]) => (
          <line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </>
  );
}

function collectNodes(svg: SVGSVGElement): RendaNodes {
  const one = <T extends SVGElement = SVGElement>(k: string) =>
    svg.querySelector(`[data-r="${k}"]`) as T;
  const all = <T extends SVGElement = SVGElement>(k: string) =>
    Array.from(svg.querySelectorAll(`[data-r="${k}"]`)) as T[];
  return {
    shape: one('shape'),
    body: one('body'),
    shadow: one('shadow'),
    highlight: one('highlight'),
    dots: one('dots'),
    dot: all('dot'),
    ticks: one('ticks'),
    eyes: all<SVGGElement>('eye').map((g) => ({
      g,
      x: Number(g.getAttribute('data-x')),
      open: g.querySelector('[data-r="open"]') as SVGElement | null,
      arc: g.querySelector('[data-r="arc"]') as SVGPathElement | null,
    })),
    sparks: all('spark'),
    ripples: all('ripple'),
  };
}

const rafAvailable = () =>
  typeof window !== 'undefined' &&
  typeof window.requestAnimationFrame === 'function';

/**
 * "Renda", the assistant character: a solid-colour jelly blob with pill eyes that
 * bobs, sways, wobbles and follows the pointer; thinking turns violet with rising dots.
 * Decorative only (`aria-hidden`); state changes are never announced through it.
 * Idle on the hero / launcher / catalog header runs the eye life cycle
 * (Rest→Wake→Glance→Blink→Drowse at size ≥36; blink-only at 20–35).
 * Reduce motion gives a still pose whose colour, accents and eye shape follow the state.
 */
function RendaCharacterImpl({
  size,
  state = 'idle',
  animated = true,
  eyes,
  surface = 'hero',
  idleEyeForce,
  className,
  style,
  'data-testid': testId,
}: RendaCharacterProps) {
  const eyesMode: RendaEyes = eyes ?? eyesForSize(size);
  const reducedMotion = usePrefersReducedMotion();
  const isStatic = !animated || reducedMotion || surface === 'avatar';
  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<RendaEngine | null>(null);
  const gazeRef = useRef<RendaGaze | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const staticRef = useRef(isStatic);
  staticRef.current = isStatic;

  const stopLoop = () => {
    if (rafRef.current != null && rafAvailable())
      window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastRef.current = null;
  };

  const startLoopRef = useRef<() => void>(() => undefined);
  startLoopRef.current = () => {
    if (rafRef.current != null || staticRef.current || !rafAvailable()) return;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    )
      return;
    const frame = (now: number) => {
      rafRef.current = null;
      const engine = engineRef.current;
      if (!engine || staticRef.current) return;
      // Battery: pause while the tab is hidden (restarts on visibility via onInteraction).
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        lastRef.current = null;
        return;
      }
      const dt =
        lastRef.current == null ? 16 : Math.min(50, now - lastRef.current);
      lastRef.current = now;
      const idleMs = msSinceInteraction();
      gazeRef.current?.update(engine);
      engine.step(dt, false, idleMs);
      if (engine.isQuiescent(false, idleMs)) {
        lastRef.current = null;
        return;
      }
      rafRef.current = window.requestAnimationFrame(frame);
    };
    rafRef.current = window.requestAnimationFrame(frame);
  };

  // Build the engine for this DOM (eye geometry depends on the eye level).
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const engine = new RendaEngine(
      collectNodes(svg),
      { size, eyes: eyesMode, surface },
      state
    );
    engineRef.current = engine;
    gazeRef.current = new RendaGaze(svg);
    engine.step(0, true, 0);
    if (!staticRef.current) startLoopRef.current();
    return () => {
      stopLoop();
      engineRef.current = null;
      gazeRef.current = null;
    };
    // `state` is applied by the effect below; rebuilding on state change would drop motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, eyesMode, surface]);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setState(state, isStatic);
    if (isStatic) {
      stopLoop();
      engine.applyInstant();
      engine.step(0, true, 0);
    } else {
      startLoopRef.current();
    }
  }, [state, isStatic]);

  // Review harness: freeze Idle eye phases for screenshots.
  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setIdleEyeForce(idleEyeForce ?? null);
    if (idleEyeForce) {
      // Paint one frame even under reduce-motion / static so screenshots work.
      engine.step(0, false, 0);
      if (!staticRef.current) startLoopRef.current();
    }
  }, [idleEyeForce]);

  // Resume after the settle / a hidden tab on the next interaction or focus.
  useEffect(() => {
    if (isStatic) return undefined;
    return onInteraction(() => startLoopRef.current());
  }, [isStatic]);

  const width = +(size * RENDA_WIDTH_RATIO).toFixed(2);
  const eyeShape = eyeShapeFor(surface, eyesMode, state);
  const floats = surface === 'hero' || surface === 'launcher';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 82 100"
      width={width}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-testid={testId}
      data-renda=""
      data-renda-state={surface === 'avatar' ? 'idle' : state}
      data-renda-eyes={eyesMode}
      data-renda-eye-shape={eyeShape}
      data-renda-motion={
        isStatic ? (reducedMotion ? 'reduced' : 'static') : 'on'
      }
      style={{
        display: 'block',
        overflow: 'visible',
        flex: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {floats && (
        <ellipse data-r="shadow" cx={CX} cy={95} rx={24} ry={3.4} fill={C.blue} opacity={0.22} />
      )}
      {[0, 1].map((i) => (
        <path
          key={i}
          data-r="ripple"
          d={RENDA_REST_PATH}
          fill="none"
          stroke={C.blue}
          strokeWidth={1.6}
          opacity={0}
        />
      ))}
      <g data-r="body">
        <path data-r="shape" d={RENDA_REST_PATH} fill={C.blue} />
        <g data-r="highlight" fill={C.highlight}>
          <ellipse cx={19} cy={42} rx={7.5} ry={3.8} opacity={0.3} transform="rotate(-38 19 42)" />
          <circle cx={27.5} cy={35.5} r={1.8} opacity={0.45} />
        </g>
        <Eyes mode={eyesMode} />
      </g>
      <Accents />
      {SPARK_ANGLES.map((a) => (
        <circle key={a} data-r="spark" r={2.4} fill={C.mote} opacity={0} />
      ))}
    </svg>
  );
}

/**
 * Static surfaces (`surface="avatar"`: 28 px message avatars and the header button)
 * render the lightweight {@link RendaAvatar}; the rAF engine only mounts for the hero, launcher and chat header.
 */
function RendaCharacterSwitch(props: RendaCharacterProps) {
  if (props.surface === 'avatar') {
    return (
      <RendaAvatar
        size={props.size}
        eyes={props.eyes}
        className={props.className}
        style={props.style}
        data-testid={props['data-testid']}
      />
    );
  }
  return <RendaCharacterImpl {...props} />;
}

export const RendaCharacter = memo(RendaCharacterSwitch);
export default RendaCharacter;
