import {
  CSSProperties,
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  CX,
  CY,
  ECHOES,
  EYE_X,
  EYE_Y,
  RENDA_COLORS as C,
  RENDA_WIDTH_RATIO,
  RING_WEDGES,
  RendaEngine,
  RendaEyes,
  RendaNodes,
  RendaRole,
  RendaState,
  SWEEP_WEDGES,
  eyeShapeFor,
  eyesForSize,
} from './rendaCharacterEngine';
import { msSinceInteraction, onInteraction } from './interactionClock';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type { RendaEyes, RendaRole, RendaState } from './rendaCharacterEngine';
export { eyesForSize } from './rendaCharacterEngine';

export interface RendaCharacterProps {
  /** Character height in px (width is 0.82 × height). */
  size: number;
  state?: RendaState;
  /** False = static character (message avatars); the eye shape still follows `state`. */
  animated?: boolean;
  /** Defaults to the size rule: expressive ≥ 36, dots 20-35, none below 20. */
  eyes?: RendaEyes;
  /** Spec "Where" column: header idle is static, avatars never move, hero/launcher settle. */
  role?: RendaRole;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

const MASK_BOX = {
  maskUnits: 'userSpaceOnUse',
  x: -60,
  y: -60,
  width: 202,
  height: 220,
} as const;
const FILTER_BOX = {
  x: '-60%',
  y: '-60%',
  width: '220%',
  height: '220%',
} as const;
const DIAMOND = 'M0 -1L.7 0L0 1L-.7 0Z';

function collectNodes(svg: SVGSVGElement): RendaNodes {
  const one = <T extends Element>(k: string) =>
    svg.querySelector(`[data-r="${k}"]`) as T;
  const all = <T extends Element>(k: string) =>
    Array.from(svg.querySelectorAll(`[data-r="${k}"]`)) as T[];
  return {
    body: one('body'),
    halo: one('halo'),
    bloom: one('bloom'),
    bloomRot: one('bloomRot'),
    ringRot: one('ringRot'),
    echoes: one('echoes'),
    echoG: all('echo'),
    sweep: one('sweep'),
    sweepRot: one('sweepRot'),
    orbits: one('orbits'),
    orbitRot: all('orbitRot'),
    eyes: all<SVGGElement>('eye').map((g) => ({
      g,
      open: g.querySelector('[data-r="open"]') as SVGEllipseElement | null,
      arc: g.querySelector('[data-r="arc"]') as SVGPathElement | null,
    })),
    sparks: all<SVGGElement>('spark').map((g) => ({
      g,
      p: g.querySelector('[data-r="sparkP"]') as SVGPathElement,
      glow: g.querySelector('[data-r="sparkGlow"]') as SVGPathElement,
    })),
    ripples: all('ripple'),
  };
}

const rafAvailable = () =>
  typeof window !== 'undefined' &&
  typeof window.requestAnimationFrame === 'function';

/**
 * "Renda", the assistant character (spec #451 §1): an upright oval ring around a
 * navy face with two white eyes. Decorative only (`aria-hidden`); state changes are
 * never announced through it. Reduce motion gives a static ring whose eye shape
 * still switches per state.
 */
function RendaCharacterImpl({
  size,
  state = 'idle',
  animated = true,
  eyes,
  role = 'hero',
  className,
  style,
  'data-testid': testId,
}: RendaCharacterProps) {
  const eyesMode: RendaEyes = eyes ?? eyesForSize(size);
  const reducedMotion = usePrefersReducedMotion();
  const isStatic = !animated || reducedMotion || role === 'avatar';
  const id = `renda${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<RendaEngine | null>(null);
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
      { size, eyes: eyesMode, role },
      state
    );
    engineRef.current = engine;
    engine.step(0, true, 0);
    if (!staticRef.current) startLoopRef.current();
    return () => {
      stopLoop();
      engineRef.current = null;
    };
    // `state` is applied by the effect below; rebuilding on state change would drop motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, eyesMode, role]);

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

  // Resume after the settle / a hidden tab on the next interaction or focus.
  useEffect(() => {
    if (isStatic) return undefined;
    return onInteraction(() => startLoopRef.current());
  }, [isStatic]);

  const width = +(size * RENDA_WIDTH_RATIO).toFixed(2);
  const url = (k: string) => `url(#${id}${k})`;
  const eyeShape = eyeShapeFor(role, eyesMode, state);

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
      data-renda-state={role === 'avatar' ? 'idle' : state}
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
      <defs>
        <mask id={`${id}rm`} {...MASK_BOX}>
          <ellipse
            cx={CX}
            cy={CY}
            rx={37}
            ry={46}
            fill="none"
            stroke="#fff"
            strokeWidth={7}
          />
        </mask>
        <mask id={`${id}bm`} {...MASK_BOX}>
          <ellipse
            cx={CX}
            cy={CY}
            rx={37}
            ry={46}
            fill="none"
            stroke="#fff"
            strokeWidth={9}
          />
        </mask>
        <mask id={`${id}fo`} {...MASK_BOX}>
          <rect x={-60} y={-60} width={202} height={220} fill="#fff" />
          <ellipse cx={CX} cy={CY} rx={33.5} ry={42.5} fill="#000" />
        </mask>
        {(
          [
            ['b06', 0.9],
            ['b1', 0.5],
            ['b2', 2.2],
            ['b4', 4.5],
          ] as const
        ).map(([k, sd]) => (
          <filter
            key={k}
            id={`${id}${k}`}
            {...FILTER_BOX}
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={sd} />
          </filter>
        ))}
        <radialGradient id={`${id}fg`} cx="50%" cy="46%" r="54%">
          <stop offset="0%" stopColor={C.navy} />
          <stop offset="62%" stopColor={C.navy} />
          <stop offset="100%" stopColor={C.navyEdge} />
        </radialGradient>
        <linearGradient id={`${id}og`} x1={0} y1={0} x2={1} y2={0}>
          <stop offset="0%" stopColor={C.light} stopOpacity={0} />
          <stop offset="55%" stopColor={C.light} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.light} stopOpacity={0.6} />
        </linearGradient>
        <g id={`${id}w`}>
          {RING_WEDGES.map((w, i) => (
            <path key={i} d={w.d} fill={w.fill} />
          ))}
        </g>
        <g id={`${id}sw`}>
          {SWEEP_WEDGES.map((w, i) => (
            <path key={i} d={w.d} fill={w.fill} fillOpacity={w.opacity} />
          ))}
        </g>
      </defs>
      <g>
        {[0, 1].map((i) => (
          <ellipse
            key={i}
            data-r="ripple"
            cx={CX}
            cy={CY}
            rx={37}
            ry={46}
            fill="none"
            stroke={C.light}
            strokeWidth={4.5}
            opacity={0}
          />
        ))}
        <g data-r="body">
          <g data-r="halo">
            <ellipse
              cx={CX}
              cy={CY}
              rx={44.5}
              ry={54.5}
              fill={C.main}
              filter={url('b4')}
            />
          </g>
          <g data-r="bloom" filter={url('b2')}>
            <g mask={url('bm')}>
              <use data-r="bloomRot" href={`#${id}w`} />
            </g>
          </g>
          <g data-r="echoes" mask={url('fo')} opacity={0}>
            {ECHOES.map(([cx, cy, rx, ry, c, sw], i) => (
              <g key={i} data-r="echo">
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke={c}
                  strokeWidth={sw}
                  filter={url('b1')}
                />
              </g>
            ))}
          </g>
          <g mask={url('rm')}>
            <use data-r="ringRot" href={`#${id}w`} filter={url('b06')} />
          </g>
          <ellipse
            cx={CX}
            cy={CY}
            rx={40.1}
            ry={49.1}
            fill="none"
            stroke={C.tint}
            strokeOpacity={0.28}
            strokeWidth={0.7}
          />
          <g data-r="sweep" opacity={0}>
            <g mask={url('rm')}>
              <use data-r="sweepRot" href={`#${id}sw`} filter={url('b06')} />
            </g>
          </g>
          <ellipse cx={CX} cy={CY} rx={33.5} ry={42.5} fill={url('fg')} />
          <ellipse
            cx={CX}
            cy={CY}
            rx={33.6}
            ry={42.6}
            fill="none"
            stroke="#000"
            strokeOpacity={0.18}
            strokeWidth={0.8}
          />
          <g data-r="orbits" mask={url('fo')} opacity={0}>
            {[-20, 20].map((tilt) => (
              <g
                key={tilt}
                transform={`translate(${CX} ${CY}) rotate(${tilt}) scale(1 .44)`}
              >
                <g data-r="orbitRot">
                  <circle
                    r={52}
                    fill="none"
                    stroke={url('og')}
                    strokeWidth={(1.5 * size) / 100}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              </g>
            ))}
          </g>
          {eyesMode !== 'none' && (
            <g>
              {EYE_X.map((x) => (
                <g key={x} data-r="eye">
                  {eyesMode === 'dot' ? (
                    <circle cx={x} cy={EYE_Y} r={5} fill={C.white} />
                  ) : (
                    <>
                      <ellipse
                        data-r="open"
                        cx={x}
                        cy={EYE_Y}
                        rx={5}
                        ry={6}
                        fill={C.white}
                      />
                      <path
                        data-r="arc"
                        d={`M${x - 6} 48Q${x} 40 ${x + 6} 48`}
                        fill="none"
                        stroke={C.white}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>
              ))}
            </g>
          )}
        </g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} data-r="spark" opacity={0}>
            <path
              data-r="sparkGlow"
              d={DIAMOND}
              transform="scale(2.1)"
              opacity={0.28}
              filter={url('b1')}
            />
            <path data-r="sparkP" d={DIAMOND} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export const RendaCharacter = memo(RendaCharacterImpl);
export default RendaCharacter;
