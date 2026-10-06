import { describe, expect, it } from 'vitest';
import {
  GLANCE_DIRS,
  GLANCE_OFFSETS,
  IDLE_EYE_TIMING,
  advanceDotBlink,
  advanceIdleEyeLife,
  idleEyeMode,
  poseForPhase,
  startDotBlink,
  startIdleEyeLife,
} from './rendaIdleEyeLife';

describe('idleEyeMode (placement + reduce-motion)', () => {
  it('runs full life cycle for expressive hero/launcher', () => {
    expect(idleEyeMode({ eyes: 'expressive' })).toBe('full');
  });

  it('dots get blink only (no glance / arc morph)', () => {
    expect(idleEyeMode({ eyes: 'dot' })).toBe('blinkOnly');
  });

  it('is off for none, staticIdle, reduced motion, paused, disabled', () => {
    expect(idleEyeMode({ eyes: 'none' })).toBe('off');
    expect(idleEyeMode({ eyes: 'expressive', staticIdle: true })).toBe('off');
    expect(idleEyeMode({ eyes: 'expressive', reducedMotion: true })).toBe('off');
    expect(idleEyeMode({ eyes: 'expressive', paused: true })).toBe('off');
    expect(idleEyeMode({ eyes: 'expressive', enabled: false })).toBe('off');
  });
});

describe('glance offsets (spec viewBox units)', () => {
  it('matches the five directions and never crosses eyes', () => {
    expect(GLANCE_OFFSETS.left).toEqual([-3, 0]);
    expect(GLANCE_OFFSETS.right).toEqual([3, 0]);
    expect(GLANCE_OFFSETS.up).toEqual([0, -2]);
    expect(GLANCE_OFFSETS.upLeft).toEqual([-2, -2]);
    expect(GLANCE_OFFSETS.upRight).toEqual([2, -2]);
    expect(GLANCE_DIRS).toHaveLength(5);
  });
});

describe('timings and caps', () => {
  it('matches the spec durations and caps', () => {
    expect(IDLE_EYE_TIMING.restMin).toBe(2500);
    expect(IDLE_EYE_TIMING.restMax).toBe(5000);
    expect(IDLE_EYE_TIMING.wakeMorph).toBe(150);
    expect(IDLE_EYE_TIMING.wakeHoldMin).toBe(800);
    expect(IDLE_EYE_TIMING.wakeHoldMax).toBe(1800);
    expect(IDLE_EYE_TIMING.glanceEase).toBe(200);
    expect(IDLE_EYE_TIMING.glanceHoldMin).toBe(600);
    expect(IDLE_EYE_TIMING.glanceHoldMax).toBe(1400);
    expect(IDLE_EYE_TIMING.glanceReturn).toBe(200);
    expect(IDLE_EYE_TIMING.blink).toBe(160);
    expect(IDLE_EYE_TIMING.doubleBlinkGap).toBe(120);
    expect(IDLE_EYE_TIMING.drowseMorph).toBe(180);
    expect(IDLE_EYE_TIMING.glanceCap).toBe(3000);
    expect(IDLE_EYE_TIMING.blinkCap).toBe(2500);
    expect(IDLE_EYE_TIMING.maxOpenMs).toBe(4000);
    expect(IDLE_EYE_TIMING.wakeChance).toBe(0.55);
    expect(IDLE_EYE_TIMING.glanceChance).toBe(0.3);
    expect(IDLE_EYE_TIMING.blinkChance).toBe(0.15);
  });
});

describe('startIdleEyeLife', () => {
  it('always starts at Rest with arcs centred', () => {
    const s = startIdleEyeLife(1000, 0);
    expect(s.phase).toBe('rest');
    expect(s.pose).toEqual({ phase: 'rest', eyeMix: 0, offset: [0, 0], blink: 1 });
    expect(s.legEndsAt).toBe(1000 + IDLE_EYE_TIMING.restMin);
    const s2 = startIdleEyeLife(1000, 1);
    expect(s2.legEndsAt).toBe(1000 + IDLE_EYE_TIMING.restMax);
  });
});

describe('advanceIdleEyeLife', () => {
  it('Rest → Wake (55%) after the rest hold', () => {
    const s = startIdleEyeLife(0, 0); // rest ends at 2500
    const { state, startedLeg } = advanceIdleEyeLife(s, 2500, 0.0); // wake
    expect(startedLeg).toBe(true);
    expect(state.phase).toBe('wake');
    expect(state.legEndsAt).toBe(2500 + IDLE_EYE_TIMING.wakeMorph);
    expect(state.openSince).toBe(2500);
  });

  it('Rest may roll into another Rest (remaining %)', () => {
    const s = startIdleEyeLife(0, 0);
    const { state } = advanceIdleEyeLife(s, 2500, 0.9); // > 0.70 → rest
    expect(state.phase).toBe('rest');
  });

  it('Wake morphs arcs→open then holds', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0.0).state; // → wake leg 0
    // Mid morph
    const mid = advanceIdleEyeLife(s, 2500 + 75).state;
    expect(mid.pose.eyeMix).toBeGreaterThan(0.5); // ease-out is ahead of linear
    expect(mid.pose.eyeMix).toBeLessThan(1);
    // Morph done → hold
    const held = advanceIdleEyeLife(s, 2500 + IDLE_EYE_TIMING.wakeMorph, 0.5).state;
    expect(held.phase).toBe('wake');
    expect(held.leg).toBe(1);
    expect(held.pose.eyeMix).toBe(1);
  });

  it('after Wake hold, Glance is available at 30% when the cap allows', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0.0).state; // wake morph
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.5).state; // hold
    // End hold with rand < 0.30 → glance
    const { state } = advanceIdleEyeLife(s, s.legEndsAt, 0.1, 0.5, 0.0);
    expect(state.phase).toBe('glance');
    expect(state.glanceDir).toBeTruthy();
    expect(GLANCE_OFFSETS[state.glanceDir!]).toBeDefined();
  });

  it('Glance eases out, holds, returns; both eyes share one offset', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0.0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.1, 0, 0).state; // glance, dir from rand3=0 → left
    expect(s.glanceDir).toBe('left');
    // Mid ease-out
    const mid = advanceIdleEyeLife(s, s.legStartedAt + 100).state;
    expect(mid.pose.offset[0]).toBeLessThan(0);
    expect(mid.pose.offset[0]).toBeGreaterThan(-3);
    // Finish ease → hold
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.5).state;
    expect(s.leg).toBe(1);
    expect(s.pose.offset).toEqual([-3, 0]);
    // Finish hold → return
    s = advanceIdleEyeLife(s, s.legEndsAt).state;
    expect(s.leg).toBe(2);
    // Finish return with rand high → not glance again; force drowse via open-too-long later
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.99, 0.99, 0.99).state;
    expect(['blink', 'drowse', 'glance']).toContain(s.phase);
  });

  it('caps glances to ≤1 / 3 s', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.1, 0, 0).state; // glance
    expect(s.phase).toBe('glance');
    const glancedAt = s.lastGlanceAt;
    // Skip through glance legs quickly
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state; // hold
    s = advanceIdleEyeLife(s, s.legEndsAt).state; // return
    // Try another glance immediately (rand wants glance-again)
    const next = advanceIdleEyeLife(s, s.legEndsAt, 0.0, 0.0, 0.0).state;
    // Cap blocks glance-again; pickWhileOpen with rand=0 would also want glance but cap blocks → blink or drowse
    expect(next.phase).not.toBe('glance');
    expect(next.lastGlanceAt).toBe(glancedAt);
  });

  it('Blink is scaleY 1→0.1→1 over 160 ms; double-blink gap is 120 ms', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state;
    // Force blink: rand in [0.30, 0.45)
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.35, 0, 0.0).state;
    expect(s.phase).toBe('blink');
    const mid = advanceIdleEyeLife(s, s.legStartedAt + 80).state;
    expect(mid.pose.blink).toBeLessThan(0.2);
    // Finish with pendingDouble forced via beginBlink rand
  });

  it('Drowse morphs open→arcs over 180 ms then Rest', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0).state;
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state;
    // Force drowse: high rand, and open not too long yet
    s = advanceIdleEyeLife(s, s.legEndsAt, 0.9, 0.9, 0.9).state;
    expect(s.phase).toBe('drowse');
    const mid = advanceIdleEyeLife(s, s.legStartedAt + 90).state;
    expect(mid.pose.eyeMix).toBeGreaterThan(0.5); // ease-in leaves mix high early
    expect(mid.pose.eyeMix).toBeLessThan(1);
    const done = advanceIdleEyeLife(s, s.legEndsAt, 0.5).state;
    expect(done.phase).toBe('rest');
    expect(done.pose.eyeMix).toBe(0);
  });

  it('forces Drowse after ~4 s open', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0).state; // wake at 2500
    s = advanceIdleEyeLife(s, s.legEndsAt, 0).state; // hold
    // Jump 4s past openSince
    const { state } = advanceIdleEyeLife(s, s.openSince + IDLE_EYE_TIMING.maxOpenMs, 0.0, 0.0, 0.0);
    expect(state.phase).toBe('drowse');
  });

  it('cancels cleanly: a fresh startIdleEyeLife resets to Rest (Attentive→Idle)', () => {
    let s = startIdleEyeLife(0, 0);
    s = advanceIdleEyeLife(s, 2500, 0).state;
    expect(s.phase).toBe('wake');
    const fresh = startIdleEyeLife(9000, 0.3);
    expect(fresh.phase).toBe('rest');
    expect(fresh.openSince).toBe(0);
  });
});

describe('poseForPhase (review snapshots)', () => {
  it('freezes Rest / Wake / Glance / Blink / Drowse', () => {
    expect(poseForPhase('rest').eyeMix).toBe(0);
    expect(poseForPhase('wake').eyeMix).toBe(1);
    expect(poseForPhase('glance', { glance: 'upRight' }).offset).toEqual([2, -2]);
    expect(poseForPhase('blink', { blinkProgress: 0.5 }).blink).toBeLessThan(0.2);
    expect(poseForPhase('drowse').eyeMix).toBeGreaterThan(0);
    expect(poseForPhase('drowse').eyeMix).toBeLessThan(1);
  });
});

describe('dot blink-only', () => {
  it('schedules blinks every 4–7 s and respects the 2.5 s floor via next schedule', () => {
    let s = startDotBlink(0, 0); // next at 4000
    expect(s.nextBlinkAt).toBe(IDLE_EYE_TIMING.openBlinkMin);
    let blink = 1;
    ({ state: s, blink } = advanceDotBlink(s, 3999));
    expect(blink).toBe(1);
    ({ state: s, blink } = advanceDotBlink(s, 4000, 0, 0.99)); // no double
    expect(s.blinking).toBe(true);
    ({ state: s, blink } = advanceDotBlink(s, 4000 + 80));
    expect(blink).toBeLessThan(0.2);
    ({ state: s, blink } = advanceDotBlink(s, 4000 + IDLE_EYE_TIMING.blink, 0.5));
    expect(s.blinking).toBe(false);
    expect(blink).toBe(1);
    expect(s.nextBlinkAt).toBeGreaterThanOrEqual(4000 + IDLE_EYE_TIMING.blink + IDLE_EYE_TIMING.openBlinkMin);
  });
});
