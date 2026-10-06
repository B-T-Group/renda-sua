import { describe, expect, it } from 'vitest';
import {
  ASPECT,
  ATTENTION_SPRING,
  BLOOM,
  BLOOM_RADIUS,
  HALO_GLOW,
  HALO_WIDE_GLOW,
  RING_OUTER,
  bloomAlphaRange,
  bloomProfile,
  bloomSegmentsForSize,
  bloomStops,
  normalCdf,
  ovalGlowExtent,
  ovalGlowStops,
  staticWedgeCountForSize,
  FACE_EDGE,
  RENDA_STATE_CONFIG,
  RING,
  RING_OVERLAY_STROKE,
  RING_SQUASH_X,
  SPARKLE_ANGLES,
  SUCCESS_SPRING,
  ARC_EYE_STROKE,
  ARC_GLOW,
  arcEyePath,
  arcGlowStrokes,
  blurredStrokeProfile,
  buildRingSegments,
  buildRingWedges,
  buildSweepWedges,
  characterWidth,
  eyeShapeFor,
  eyesForSize,
  haloAlphaRange,
  haloColor,
  mixHex,
  nextBlinkDelay,
  resolveRendaConfig,
  ringColorAt,
  sampleCurve,
  sparkleColor,
  sparklePath,
  springPeakPerVelocity,
  springVelocityForPeak,
  wedgeCountForSize,
  type RendaCharacterState,
} from './rendaCharacterModel';

const ALL_STATES = Object.keys(RENDA_STATE_CONFIG) as RendaCharacterState[];
const BRAND_HEX = new Set(['#0A4FB5', '#2F6FD6', '#8FB6F0', '#0B2E6F', '#FFFFFF']);

describe('eye level from size (spec §1)', () => {
  it.each([
    [128, 'expressive'],
    [52, 'expressive'],
    [40, 'expressive'],
    [36, 'expressive'],
    [35, 'dot'],
    [28, 'dot'],
    [20, 'dot'],
    [19, 'none'],
    [16, 'none'],
  ])('size %i → %s', (size, eyes) => {
    expect(eyesForSize(size)).toBe(eyes);
  });

  it('keeps the 0.82 aspect', () => {
    expect(ASPECT).toBeCloseTo(0.82);
    expect(characterWidth(100)).toBeCloseTo(82);
    expect(characterWidth(52)).toBeCloseTo(42.64);
  });

  it('dot and none levels ignore the state eye shape', () => {
    expect(eyeShapeFor('dot', { eyes: 'open' })).toBe('dot');
    expect(eyeShapeFor('none', { eyes: 'arc' })).toBe('none');
    expect(eyeShapeFor('expressive', { eyes: 'open' })).toBe('open');
  });

  it('arc eye is 12 wide and 4 tall around the eye centre', () => {
    expect(arcEyePath(28, 46)).toBe('M22 48Q28 40 34 48');
  });
});

describe('state table (spec §1)', () => {
  it('maps eyes and offsets per state', () => {
    expect(RENDA_STATE_CONFIG.idle).toMatchObject({ eyes: 'arc', offset: [0, 0], amp: 0.03, period: 3200, spin: true });
    expect(RENDA_STATE_CONFIG.attentive).toMatchObject({ eyes: 'open', amp: 0, spin: false, halo: 'max', blink: true });
    expect(RENDA_STATE_CONFIG.listening).toMatchObject({ eyes: 'open', offset: [0, 2], amp: 0, spin: false });
    expect(RENDA_STATE_CONFIG.thinking).toMatchObject({ eyes: 'open', offset: [2, -2], amp: 0.04, period: 1200, orbits: true });
    expect(RENDA_STATE_CONFIG.responding).toMatchObject({ eyes: 'arc', period: 1600 });
    expect(RENDA_STATE_CONFIG.success).toMatchObject({ eyes: 'arc' });
  });

  it('nothing loops faster than 1 Hz', () => {
    for (const s of ALL_STATES) {
      expect(RENDA_STATE_CONFIG[s].period).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('resolveRendaConfig: reduced motion and static modes', () => {
  it('reduced motion: no loops or one-shots, eye shape still switches per state', () => {
    for (const s of ALL_STATES) {
      const c = resolveRendaConfig(s, { animated: true, reducedMotion: true });
      expect(c.loops).toBe(false);
      expect(c.oneShots).toBe(false);
      expect(c.amp).toBe(0);
      expect(c.spin).toBe(false);
      expect(c.orbits).toBe(false);
      expect(c.blink).toBe(false);
      expect(c.eyes).toBe(RENDA_STATE_CONFIG[s].eyes);
      expect(c.offset).toEqual(RENDA_STATE_CONFIG[s].offset);
    }
  });

  it('reduced motion keeps Thinking readable through the eyes', () => {
    const c = resolveRendaConfig('thinking', { animated: true, reducedMotion: true });
    expect(c.eyes).toBe('open');
    expect(c.offset).toEqual([2, -2]);
  });

  it('animated=false is a static drawing', () => {
    const c = resolveRendaConfig('idle', { animated: false, reducedMotion: false });
    expect(c).toMatchObject({ loops: false, oneShots: false, halo: 'mid', eyes: 'arc' });
  });

  it('header (staticIdle): idle static, attentive/listening read as idle, thinking animates', () => {
    const mode = { animated: true, reducedMotion: false, staticIdle: true };
    expect(resolveRendaConfig('idle', mode)).toMatchObject({ loops: false, spin: false, amp: 0, halo: 'mid' });
    expect(resolveRendaConfig('listening', mode)).toMatchObject({ eyes: 'arc', offset: [0, 0], loops: false });
    expect(resolveRendaConfig('attentive', mode).eyes).toBe('arc');
    expect(resolveRendaConfig('thinking', mode)).toMatchObject({ loops: true, orbits: true, eyes: 'open' });
  });

  it('paused stops loops and blinks but keeps the eye shape', () => {
    const c = resolveRendaConfig('listening', { animated: true, reducedMotion: false, paused: true });
    expect(c).toMatchObject({ loops: false, blink: false, oneShots: false, eyes: 'open', offset: [0, 2] });
  });

  it('full motion runs loops and one-shots', () => {
    expect(resolveRendaConfig('idle', { animated: true, reducedMotion: false })).toMatchObject({ loops: true, oneShots: true });
    expect(resolveRendaConfig('attentive', { animated: true, reducedMotion: false })).toMatchObject({ loops: false, blink: true });
  });
});

describe('timing helpers', () => {
  it('blinks every 4–7 s', () => {
    expect(nextBlinkDelay(0)).toBe(4000);
    expect(nextBlinkDelay(0.5)).toBe(5500);
    expect(nextBlinkDelay(0.9999)).toBeLessThan(7000);
    expect(nextBlinkDelay(5)).toBe(7000);
    expect(nextBlinkDelay(-1)).toBe(4000);
  });

  it('success spring peaks at 1.08 and attention at 1.10', () => {
    const v = springVelocityForPeak(0.08, SUCCESS_SPRING);
    expect(v * springPeakPerVelocity(SUCCESS_SPRING)).toBeCloseTo(0.08, 6);
    // Analytic check for d12 k180: peak ≈ 0.0429 v.
    expect(springPeakPerVelocity(SUCCESS_SPRING)).toBeCloseTo(0.0429, 3);
    const va = springVelocityForPeak(0.1, ATTENTION_SPRING);
    expect(va * springPeakPerVelocity(ATTENTION_SPRING)).toBeCloseTo(0.1, 6);
  });

  it('overdamped springs have no peak', () => {
    expect(springPeakPerVelocity({ stiffness: 100, damping: 40 })).toBe(0);
    expect(springVelocityForPeak(0.1, { stiffness: 100, damping: 40 })).toBe(0);
  });

  it('samples eased curves into native-driver ranges', () => {
    const r = sampleCurve((p) => p * p, 5);
    expect(r.inputRange).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(r.outputRange).toEqual([0, 0.063, 0.25, 0.563, 1]);
    expect(sampleCurve((p) => p, 1).inputRange).toHaveLength(2);
  });
});

describe('colours and ring gradient', () => {
  it('uses brand tokens only (no gold/orange)', () => {
    expect(ringColorAt(0)).toBe('#2F6FD6');
    expect(ringColorAt(45)).toBe('#8FB6F0');
    expect(ringColorAt(200)).toBe('#0A4FB5');
    expect(ringColorAt(360)).toBe('#2F6FD6');
    expect(ringColorAt(-315)).toBe('#8FB6F0');
    expect(FACE_EDGE).toBe(mixHex('#0B2E6F', '#000000', 0.12));
    expect(BRAND_HEX.has(haloColor(false))).toBe(true);
    expect(haloColor(false)).toBe('#0A4FB5');
    expect(haloColor(true)).toBe('#2F6FD6');
  });

  it('halo alpha: 16–28% light, 30–45% dark', () => {
    expect(haloAlphaRange(false)).toEqual([0.16, 0.28]);
    expect(haloAlphaRange(true)).toEqual([0.3, 0.45]);
  });

  it('green only in the success sparkle', () => {
    expect(sparkleColor(0, false)).toBe('#0B7A3B');
    expect(sparkleColor(1, false)).toBe('#0F9B48');
    expect(sparkleColor(1, true)).toBe('#8FB6F0');
  });

  it('builds 120 wedges like the prototype and fewer on small sizes', () => {
    const w = buildRingWedges(120, 41, 50, 72);
    expect(w).toHaveLength(120);
    expect(w[0].d.startsWith('M41 50L')).toBe(true);
    expect(wedgeCountForSize(128)).toBe(120);
    expect(wedgeCountForSize(52)).toBe(72);
    expect(wedgeCountForSize(40)).toBe(48);
    expect(wedgeCountForSize(28)).toBe(32);
  });

  it('annulus segments stay inside the overlay stroke', () => {
    const segs = buildRingSegments(48, 41, 50, RING.ry, RING_OVERLAY_STROKE);
    expect(segs).toHaveLength(48);
    const nums = segs[0].d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    for (const [x, y] of pts) {
      const r = Math.hypot(x - 41, y - 50);
      expect(r).toBeGreaterThanOrEqual(RING.ry - RING_OVERLAY_STROKE / 2 - 1e-3);
      expect(r).toBeLessThanOrEqual(RING.ry + RING_OVERLAY_STROKE / 2 + 1e-3);
    }
  });

  it('squashed overlay stays within ±0.5 of the exact 7-wide ring', () => {
    const sideOuter = (RING.ry + RING_OVERLAY_STROKE / 2) * RING_SQUASH_X;
    const sideInner = (RING.ry - RING_OVERLAY_STROKE / 2) * RING_SQUASH_X;
    expect(Math.abs(sideOuter - (RING.rx + RING.stroke / 2))).toBeLessThan(0.5);
    expect(Math.abs(sideInner - (RING.rx - RING.stroke / 2))).toBeLessThan(0.5);
    const top = RING.ry + RING_OVERLAY_STROKE / 2;
    expect(Math.abs(top - (RING.ry + RING.stroke / 2))).toBeLessThan(0.5);
  });

  it('sweep fades from a bright head into a tail', () => {
    const s = buildSweepWedges(41, 50, 50);
    expect(s.length).toBeGreaterThan(50);
    const maxOpacity = Math.max(...s.map((w) => w.opacity));
    expect(maxOpacity).toBeGreaterThan(0.9);
    expect(maxOpacity).toBeLessThanOrEqual(0.95);
    expect(s[s.length - 1].opacity).toBeLessThan(0.05);
  });

  it('six sparkles at 30°…330° travel outward 14 units', () => {
    expect(SPARKLE_ANGLES).toEqual([30, 90, 150, 210, 270, 330]);
    const p = sparklePath(90);
    expect(p.to[0] - p.from[0]).toBeCloseTo(14);
    expect(p.to[1]).toBeCloseTo(p.from[1]);
  });
});

describe('glow: blurred prototype shapes as gradient stops (no native SVG filters)', () => {
  it('normal CDF matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024998, 5);
    expect(normalCdf(3) + normalCdf(-3)).toBeCloseTo(1, 6);
  });

  it('halo stops fall off like the prototype blur (oval 44.5 × 54.5, σ 4.5)', () => {
    const stops = ovalGlowStops(HALO_GLOW);
    const { rx, ry } = ovalGlowExtent(HALO_GLOW);
    // Ends 3σ beyond the blurred edge and stays inside the ring until the edge zone.
    expect(ry).toBeCloseTo(RING_OUTER.ry + 4.5 + 13.5);
    expect(stops[0]).toEqual({ offset: 0, opacity: 1 });
    expect(stops[stops.length - 1].opacity).toBe(0);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset);
      expect(stops[i].opacity).toBeLessThanOrEqual(stops[i - 1].opacity);
    }
    // Half intensity at the blurred edge, on both axes (aspect chosen for that).
    const tHalf = (RING_OUTER.ry + HALO_GLOW.edge) / ry;
    expect((RING_OUTER.rx + HALO_GLOW.edge) / rx).toBeCloseTo(tHalf, 6);
    const near = stops.reduce((a, b) => (Math.abs(b.offset - tHalf) < Math.abs(a.offset - tHalf) ? b : a));
    expect(near.opacity).toBeGreaterThan(0.35);
    expect(near.opacity).toBeLessThan(0.65);
  });

  it('dark wide halo is broader and fits its padded box', () => {
    expect(ovalGlowExtent(HALO_WIDE_GLOW).ry).toBeGreaterThan(ovalGlowExtent(HALO_GLOW).ry);
  });

  it('bloom: blurred 9-wide band on the ring centreline (σ 2.2)', () => {
    expect(bloomProfile(46)).toBeCloseTo(normalCdf(4.5 / 2.2) - normalCdf(-4.5 / 2.2), 6);
    expect(bloomProfile(46 + BLOOM.halfWidth)).toBeCloseTo(0.5, 1);
    expect(bloomProfile(BLOOM_RADIUS)).toBeLessThan(0.01);
    const stops = bloomStops(10);
    expect(stops[stops.length - 1]).toEqual({ offset: 1, opacity: 0 });
    const peak = stops.reduce((a, b) => (b.opacity > a.opacity ? b : a));
    expect(peak.offset * BLOOM_RADIUS).toBeGreaterThan(43);
    expect(peak.offset * BLOOM_RADIUS).toBeLessThan(49);
  });

  it('bloom alpha follows the prototype (.22–.32 light, .55–.90 dark) with soft-glow segment counts', () => {
    expect(bloomAlphaRange(false)).toEqual([0.22, 0.32]);
    expect(bloomAlphaRange(true)).toEqual([0.55, 0.9]);
    expect(bloomSegmentsForSize(128)).toBe(36);
    expect(bloomSegmentsForSize(52)).toBe(24);
  });

  it('translucent segments do not overlap (overlaps would show as spokes)', () => {
    const [a, b] = buildRingSegments(24, 41, 50, 46, 10, 0);
    // Segment 0 ends exactly where segment 1 starts.
    const endA = a.d.split('L')[1];
    const startB = b.d.slice(1).split('L')[0];
    expect(endA.trim()).toBe(startB.trim());
  });

  it('static drawings use fewer ring segments below 36 px', () => {
    expect(staticWedgeCountForSize(28)).toBe(24);
    expect(staticWedgeCountForSize(40)).toBe(wedgeCountForSize(40));
  });
});

describe('dark-mode eye glow and listening offset', () => {
  it('arc glow: faint stacked strokes that hug the arc (no disc behind it)', () => {
    const strokes = arcGlowStrokes();
    expect(strokes.map((g) => g.width)).toEqual([...ARC_GLOW.radii].reverse().map((r) => r * 2));
    // Widest stroke reaches only 5.5 units from the centreline (the old disc was 9 × 10).
    expect(strokes[0].width / 2).toBeLessThanOrEqual(5.5);
    expect(Math.min(...strokes.map((g) => g.width))).toBeGreaterThan(ARC_EYE_STROKE);
    // Stacked alpha just outside the stroke stays faint and falls off outwards.
    const alphaAt = (d: number) =>
      1 - strokes.filter((g) => g.width / 2 > d).reduce((t, g) => t * (1 - g.opacity), 1);
    expect(alphaAt(2)).toBeLessThan(0.3);
    expect(alphaAt(2)).toBeGreaterThan(alphaAt(3));
    expect(alphaAt(3)).toBeGreaterThan(alphaAt(5));
    expect(alphaAt(6)).toBe(0);
    for (const g of strokes) expect(g.opacity).toBeGreaterThanOrEqual(0);
  });

  it('blurred stroke profile peaks on the centreline and halves near the edge', () => {
    expect(blurredStrokeProfile(0, 1.75, 1.6)).toBeGreaterThan(blurredStrokeProfile(1.75, 1.75, 1.6));
    expect(blurredStrokeProfile(1.75, 1.75, 1.6)).toBeCloseTo(0.5 - (1 - normalCdf(3.5 / 1.6)), 2);
  });

  it('listening looks down 2 from attentive (spec: open, offset down 2)', () => {
    expect(RENDA_STATE_CONFIG.attentive.offset).toEqual([0, 0]);
    expect(RENDA_STATE_CONFIG.listening.offset).toEqual([0, 2]);
    expect(RENDA_STATE_CONFIG.listening.eyes).toBe('open');
  });
});
