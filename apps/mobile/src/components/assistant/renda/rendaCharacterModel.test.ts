import { describe, expect, it } from 'vitest';
import { rendaCharacterTokens as T } from '../../../theme/rendaCharacterTokens';
import {
  ASPECT,
  BLOB,
  BLOB_BASE_Y,
  BLOB_PATH,
  EYE_X,
  EYE_Y,
  HOP_PEAK,
  HOP_SPRING,
  RENDA_STATE_CONFIG,
  SPARKLE_ANGLES,
  THINK_DOTS,
  TICKS,
  arcEyePath,
  bobWave,
  characterWidth,
  dotBounce,
  eyeShapeFor,
  eyesForSize,
  nextBlinkDelay,
  resolveRendaConfig,
  sampleCurve,
  scanX,
  scanY,
  sparklePath,
  springPeakPerVelocity,
  springVelocityForPeak,
  swayWave,
  type RendaCharacterState,
} from './rendaCharacterModel';

const ALL_STATES = Object.keys(RENDA_STATE_CONFIG) as RendaCharacterState[];
const coords = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('eye level from size', () => {
  it.each([
    [128, 'expressive'],
    [52, 'expressive'],
    [36, 'expressive'],
    [35, 'dot'],
    [20, 'dot'],
    [19, 'none'],
  ])('size %i → %s', (size, eyes) => {
    expect(eyesForSize(size)).toBe(eyes);
  });

  it('keeps the 0.82 aspect', () => {
    expect(ASPECT).toBeCloseTo(0.82);
    expect(characterWidth(100)).toBeCloseTo(82);
  });

  it('dot and none levels ignore the state eye shape', () => {
    expect(eyeShapeFor('dot', { eyes: 'open' })).toBe('dot');
    expect(eyeShapeFor('none', { eyes: 'arc' })).toBe('none');
    expect(eyeShapeFor('expressive', { eyes: 'open' })).toBe('open');
  });

  it('happy arc is centred on the eye', () => {
    expect(arcEyePath(40, 54)).toBe('M35.4 56.2Q40 48.8 44.6 56.2');
  });
});

describe('jelly blob geometry (matches web)', () => {
  it('is a closed blob, wider than tall, inside the viewBox', () => {
    expect(BLOB_PATH.startsWith('M')).toBe(true);
    expect(BLOB_PATH.endsWith('Z')).toBe(true);
    const n = coords(BLOB_PATH);
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    expect(w / h).toBeGreaterThan(1.15);
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...xs)).toBeLessThan(82);
    expect(Math.min(...ys)).toBeGreaterThan(25);
    expect(Math.max(...ys)).toBeLessThan(92);
  });

  it('pivots on its base; eyes sit inside the body', () => {
    expect(BLOB_BASE_Y).toBe(BLOB.cy + BLOB.ry);
    for (const x of EYE_X) {
      expect(Math.abs(x - BLOB.cx)).toBeLessThan(BLOB.rx * 0.5);
    }
    expect(EYE_Y).toBeGreaterThan(BLOB.cy - BLOB.ry);
  });

  it('accents sit above the body, top-right', () => {
    for (const [cx, cy] of THINK_DOTS) {
      expect(cx).toBeGreaterThan(BLOB.cx);
      expect(cy).toBeLessThan(BLOB.cy - BLOB.ry);
    }
    for (const [x1, y1, x2, y2] of TICKS) {
      expect(Math.min(x1, x2)).toBeGreaterThan(BLOB.cx);
      expect(Math.max(y1, y2)).toBeLessThan(BLOB.cy - BLOB.ry);
    }
  });
});

describe('palette', () => {
  it('solid blue body, violet thinking, white eyes', () => {
    expect(T.blue).toBe('#2F6BFF');
    expect(T.violet).toBe('#8B5CF6');
    expect(T.eye).toBe('#FFFFFF');
  });
});

describe('state table', () => {
  it('maps eyes and offsets per state', () => {
    expect(RENDA_STATE_CONFIG.idle).toMatchObject({ eyes: 'open', offset: [0, 0] });
    expect(RENDA_STATE_CONFIG.attentive).toMatchObject({ eyes: 'open', blink: true, ticks: true });
    expect(RENDA_STATE_CONFIG.listening).toMatchObject({ eyes: 'open', offset: [0, 2], ticks: true });
    expect(RENDA_STATE_CONFIG.thinking).toMatchObject({ eyes: 'open', offset: [2, -2], tint: 1, dots: true, scan: true });
    expect(RENDA_STATE_CONFIG.responding).toMatchObject({ eyes: 'arc', ticks: true });
    expect(RENDA_STATE_CONFIG.success).toMatchObject({ eyes: 'arc' });
  });

  it('only thinking turns violet, shows dots and scans', () => {
    expect(ALL_STATES.filter((s) => RENDA_STATE_CONFIG[s].tint > 0)).toEqual(['thinking']);
    expect(ALL_STATES.filter((s) => RENDA_STATE_CONFIG[s].dots)).toEqual(['thinking']);
    expect(ALL_STATES.filter((s) => RENDA_STATE_CONFIG[s].scan)).toEqual(['thinking']);
  });

  it('idle is alive: it bobs, sways and squashes', () => {
    const idle = RENDA_STATE_CONFIG.idle;
    expect(idle.bob).toBeGreaterThan(1);
    expect(idle.sway).toBeGreaterThan(1);
    expect(idle.amp).toBeGreaterThan(0);
  });

  it('thinking has the biggest sway and quickest tempo of the calm states', () => {
    for (const s of ALL_STATES) expect(RENDA_STATE_CONFIG.thinking.sway).toBeGreaterThanOrEqual(RENDA_STATE_CONFIG[s].sway);
    expect(RENDA_STATE_CONFIG.thinking.tempo).toBeGreaterThan(RENDA_STATE_CONFIG.idle.tempo);
  });

  it('nothing squashes faster than 1 Hz', () => {
    for (const s of ALL_STATES) expect(RENDA_STATE_CONFIG[s].period).toBeGreaterThanOrEqual(1000);
  });
});

describe('resolveRendaConfig: reduced motion and static modes', () => {
  it('reduced motion: still body, but colour, accents and eyes follow the state', () => {
    for (const s of ALL_STATES) {
      const c = resolveRendaConfig(s, { animated: true, reducedMotion: true });
      expect(c).toMatchObject({ loops: false, oneShots: false, amp: 0, bob: 0, sway: 0, scan: false, blink: false });
      expect(c.eyes).toBe(RENDA_STATE_CONFIG[s].eyes);
      expect(c.offset).toEqual(RENDA_STATE_CONFIG[s].offset);
      expect(c.tint).toBe(RENDA_STATE_CONFIG[s].tint);
      expect(c.dots).toBe(RENDA_STATE_CONFIG[s].dots);
    }
  });

  it('animated=false is a static drawing', () => {
    expect(resolveRendaConfig('idle', { animated: false, reducedMotion: false })).toMatchObject({ loops: false, oneShots: false, eyes: 'open' });
  });

  it('header (staticIdle): a gentler idle; attentive/listening read as idle; thinking animates', () => {
    const mode = { animated: true, reducedMotion: false, staticIdle: true };
    const header = resolveRendaConfig('idle', mode);
    expect(header.loops).toBe(true);
    expect(header.bob).toBeLessThan(RENDA_STATE_CONFIG.idle.bob);
    expect(header.sway).toBeLessThan(RENDA_STATE_CONFIG.idle.sway);
    expect(resolveRendaConfig('listening', mode)).toMatchObject({ offset: [0, 0], ticks: false });
    expect(resolveRendaConfig('thinking', mode)).toMatchObject({ loops: true, dots: true, tint: 1 });
  });

  it('paused stops loops and blinks but keeps eyes, colour and accents', () => {
    const c = resolveRendaConfig('thinking', { animated: true, reducedMotion: false, paused: true });
    expect(c).toMatchObject({ loops: false, blink: false, oneShots: false, eyes: 'open', tint: 1, dots: true });
  });

  it('full motion runs loops and one-shots', () => {
    expect(resolveRendaConfig('idle', { animated: true, reducedMotion: false })).toMatchObject({ loops: true, oneShots: true });
    expect(resolveRendaConfig('attentive', { animated: true, reducedMotion: false })).toMatchObject({ loops: true, blink: true });
  });
});

describe('procedural waves (native-driver loops)', () => {
  const wraps = (fn: (p: number) => number) => expect(fn(1)).toBeCloseTo(fn(0), 4);

  it('every loop wave wraps seamlessly', () => {
    for (const fn of [bobWave, swayWave, scanX, scanY, dotBounce(0), dotBounce(2)]) wraps(fn);
  });

  it('bob and sway stay within ±1 and actually move', () => {
    const s = sampleCurve(bobWave, 241).outputRange;
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(1.2);
    const w = sampleCurve(swayWave, 241).outputRange;
    expect(Math.max(...w) - Math.min(...w)).toBeGreaterThan(1.2);
  });

  it('thinking dots bounce in sequence (each peaks later)', () => {
    const peakAt = (i: number) => {
      const r = sampleCurve(dotBounce(i), 401);
      return r.inputRange[r.outputRange.indexOf(Math.max(...r.outputRange))];
    };
    expect(peakAt(1)).toBeGreaterThan(peakAt(0));
    expect(peakAt(2)).toBeGreaterThan(peakAt(1));
  });

  it('scan sweeps the eyes between up-right (0) and up-left (−3), dwelling at each side', () => {
    const r = sampleCurve(scanX, 101).outputRange;
    expect(Math.max(...r)).toBeCloseTo(0, 1);
    expect(Math.min(...r)).toBeCloseTo(-3, 1);
    const atSides = r.filter((x) => x > -0.4 || x < -2.6).length;
    expect(atSides / r.length).toBeGreaterThan(0.4);
    expect(Math.min(...sampleCurve(scanY, 101).outputRange)).toBeLessThan(-0.5);
  });
});

describe('timing helpers', () => {
  it('blinks every 4–7 s', () => {
    expect(nextBlinkDelay(0)).toBe(4000);
    expect(nextBlinkDelay(0.5)).toBe(5500);
    expect(nextBlinkDelay(5)).toBe(7000);
    expect(nextBlinkDelay(-1)).toBe(4000);
  });

  it('hop spring overshoots to the per-state peak; success and attention hop highest', () => {
    for (const s of ALL_STATES) {
      const v = springVelocityForPeak(HOP_PEAK[s], HOP_SPRING);
      expect(v * springPeakPerVelocity(HOP_SPRING)).toBeCloseTo(HOP_PEAK[s], 6);
    }
    expect(HOP_PEAK.attention).toBeGreaterThan(HOP_PEAK.idle);
    expect(HOP_PEAK.success).toBeGreaterThan(HOP_PEAK.thinking);
  });

  it('overdamped springs have no peak', () => {
    expect(springPeakPerVelocity({ stiffness: 100, damping: 40 })).toBe(0);
    expect(springVelocityForPeak(0.1, { stiffness: 100, damping: 40 })).toBe(0);
  });

  it('samples curves into native-driver ranges', () => {
    const r = sampleCurve((p) => p * p, 5);
    expect(r.inputRange).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(r.outputRange).toEqual([0, 0.063, 0.25, 0.563, 1]);
    expect(sampleCurve((p) => p, 1).inputRange).toHaveLength(2);
  });

  it('six motes drift outward and up from the blob edge', () => {
    expect(SPARKLE_ANGLES).toEqual([30, 90, 150, 210, 270, 330]);
    const p = sparklePath(90);
    expect(p.to[0] - p.from[0]).toBeCloseTo(12);
    expect(p.to[1]).toBeLessThan(p.from[1]);
  });
});
