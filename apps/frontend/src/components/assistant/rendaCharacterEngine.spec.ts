import {
  RENDA_COLORS,
  RENDA_REST_PATH,
  RENDA_STATES,
  RendaEngine,
  RendaNodes,
  RendaState,
  SETTLE_AFTER_MS,
  eyeShapeFor,
  eyesForSize,
  stateConfigFor,
} from './rendaCharacterEngine';
import { SHAPE_N, mixHex, rendaShapePath } from './rendaCharacterTokens';

describe('eyesForSize', () => {
  it.each([
    [160, 'expressive'],
    [52, 'expressive'],
    [40, 'expressive'],
    [36, 'expressive'],
    [35, 'dot'],
    [28, 'dot'],
    [20, 'dot'],
    [19, 'none'],
    [16, 'none'],
  ])('%i px → %s', (size, eyes) => {
    expect(eyesForSize(size)).toBe(eyes);
  });
});

describe('eye shape per state (spec §1 table)', () => {
  it.each([
    ['idle', 'open'],
    ['attentive', 'open'],
    ['listening', 'open'],
    ['thinking', 'open'],
    ['responding', 'arc'],
    ['success', 'arc'],
    ['attention', 'open'],
  ] as const)('hero %s → %s', (state, shape) => {
    expect(eyeShapeFor('hero', 'expressive', state)).toBe(shape);
  });

  it('listening looks down 2 and thinking looks up-right (+2, −2)', () => {
    expect(stateConfigFor('hero', 'expressive', 'listening').off).toEqual([0, 2]);
    expect(stateConfigFor('hero', 'expressive', 'thinking').off).toEqual([2, -2]);
  });

  it('the header ignores attentive/listening and keeps a gentler idle', () => {
    expect(stateConfigFor('header', 'expressive', 'listening').ticks).toBe(0);
    const header = stateConfigFor('header', 'expressive', 'idle');
    const hero = stateConfigFor('hero', 'expressive', 'idle');
    expect(header.float).toBeGreaterThan(0);
    expect(header.float).toBeLessThan(hero.float);
    expect(header.sway).toBeLessThan(hero.sway);
    expect(stateConfigFor('header', 'expressive', 'thinking').dots).toBe(1);
  });

  it('dot and no-eye sizes never morph; avatars never move', () => {
    expect(eyeShapeFor('avatar', 'dot', 'thinking')).toBe('dot');
    expect(eyeShapeFor('hero', 'none', 'thinking')).toBe('none');
    const avatar = stateConfigFor('avatar', 'dot', 'success');
    expect([avatar.amp, avatar.flow, avatar.float, avatar.sway, avatar.look]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('state profiles', () => {
  const s = RENDA_STATES;
  const states = Object.keys(s) as RendaState[];
  it('only thinking turns violet, shows the dots and scans with its eyes', () => {
    expect(states.filter((k) => s[k].tint > 0)).toEqual(['thinking']);
    expect(states.filter((k) => s[k].dots > 0)).toEqual(['thinking']);
    expect(states.filter((k) => s[k].scan > 0)).toEqual(['thinking']);
  });

  it('thinking is the liveliest body: biggest sway and wobble', () => {
    for (const k of states) expect(s.thinking.sway).toBeGreaterThanOrEqual(s[k].sway);
    for (const k of states) expect(s.thinking.deform).toBeGreaterThanOrEqual(s[k].deform);
  });

  it('idle is alive: it bobs, sways, wobbles and wanders its gaze', () => {
    expect(s.idle.float).toBeGreaterThan(1);
    expect(s.idle.sway).toBeGreaterThan(1);
    expect(s.idle.deform).toBeGreaterThan(0);
    expect(s.idle.wander).toBeGreaterThan(0);
  });

  it('listening and responding show signal ticks; thinking focuses (narrow eyes)', () => {
    expect(s.listening.ticks).toBe(1);
    expect(s.responding.ticks).toBe(1);
    expect(s.thinking.eyeScale[1]).toBeLessThan(s.thinking.eyeScale[0]);
    expect(s.success.eyeScale[0]).toBeGreaterThan(1);
  });
});

describe('palette', () => {
  it('solid blue body; thinking violet; white eyes', () => {
    expect(RENDA_COLORS.blue).toBe('#2F6BFF');
    expect(RENDA_COLORS.violet).toBe('#8B5CF6');
    expect(RENDA_COLORS.eye).toBe('#FFFFFF');
  });

  it('mixHex blends channel by channel', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex(RENDA_COLORS.blue, RENDA_COLORS.violet, 0)).toBe('#2f6bff');
    expect(mixHex(RENDA_COLORS.blue, RENDA_COLORS.violet, 1)).toBe('#8b5cf6');
  });
});

describe('silhouette', () => {
  const coords = (d: string) => (d.match(/-?[\d.]+/g) ?? []).map(Number);

  it('is a closed jelly blob, wider than tall, inside the viewBox', () => {
    expect(RENDA_REST_PATH.startsWith('M')).toBe(true);
    expect(RENDA_REST_PATH.endsWith('Z')).toBe(true);
    const n = coords(RENDA_REST_PATH);
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

  it('organic deformation changes the outline only slightly', () => {
    const dyn = Array.from({ length: SHAPE_N }, (_, i) => (i % 2 ? 0.04 : -0.04));
    const a = coords(RENDA_REST_PATH);
    const b = coords(rendaShapePath(dyn));
    expect(b).not.toEqual(a);
    a.forEach((v, i) => expect(Math.abs(b[i] - v)).toBeLessThan(4));
  });
});

/* ------------------------------ engine ------------------------------ */
type FakeEl = { attrs: Record<string, string>; writes: number; setAttribute: (k: string, v: string) => void };
const el = (): FakeEl => {
  const e: FakeEl = {
    attrs: {},
    writes: 0,
    setAttribute: (k, v) => {
      e.attrs[k] = v;
      e.writes++;
    },
  };
  return e;
};
const many = (n: number) => Array.from({ length: n }, el);

function fakeNodes() {
  const nodes = {
    shape: el(), body: el(), shadow: el(), highlight: el(), dots: el(), dot: many(3), ticks: el(),
    eyes: [{ g: el(), x: 33.5, open: el(), arc: el() }],
    sparks: many(6), ripples: many(2),
  };
  const all = (): FakeEl[] => [
    nodes.shape, nodes.body, nodes.shadow, nodes.highlight, nodes.dots, ...nodes.dot, nodes.ticks,
    ...nodes.eyes.flatMap((e) => [e.g, e.open, e.arc]),
    ...nodes.sparks, ...nodes.ripples,
  ];
  return { raw: nodes, nodes: nodes as unknown as RendaNodes, totalWrites: () => all().reduce((s, e) => s + e.writes, 0) };
}
const make = (state: RendaState = 'idle', surface: 'hero' | 'header' | 'launcher' = 'hero') => {
  const f = fakeNodes();
  const engine = new RendaEngine(f.nodes, { size: 160, eyes: 'expressive', surface }, state, () => 0);
  return { ...f, engine };
};
const run = (engine: RendaEngine, ms: number, idleMs = 0) => {
  for (let t = 0; t < ms; t += 16) engine.step(16, false, idleMs);
};
const translate = (s = '') => {
  const m = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

describe('RendaEngine eyes', () => {
  it('a character that mounts already Attentive still blinks (first blink within ~1 s)', () => {
    const { engine, raw } = make('attentive');
    expect(engine.isQuiescent(false, 0)).toBe(false);
    let minScaleY = 1;
    for (let t = 0; t < 1000; t += 16) {
      engine.step(16, false, 0);
      const m = /scale\(([\d.]+) ([\d.]+)\)/.exec(raw.eyes[0].open.attrs.transform || '');
      if (m) minScaleY = Math.min(minScaleY, Number(m[2]));
    }
    expect(minScaleY).toBeLessThan(0.5);
  });

  it('listening eye translate settles at y = 2 (spec §1: offset down 2)', () => {
    const { engine, raw } = make();
    engine.setState('listening', false);
    run(engine, 640);
    const [x, y] = translate(raw.eyes[0].g.attrs.transform) ?? [NaN, NaN];
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(2, 1);
  });

  it('eyes follow the pointer and return when it goes away', () => {
    const { engine, raw } = make();
    engine.setLook(1, 0);
    run(engine, 600);
    expect(translate(raw.eyes[0].g.attrs.transform)?.[0]).toBeGreaterThan(1.5);
    engine.setLook(0, 0);
    run(engine, 800);
    expect(Math.abs(translate(raw.eyes[0].g.attrs.transform)?.[0] ?? 9)).toBeLessThan(0.1);
  });

  it('idle eyes stay pills (never the happy arc) through the life cycle', () => {
    const { engine, raw } = make();
    for (let t = 0; t < 8000; t += 16) {
      engine.step(16, false, 0);
      expect(Number(raw.eyes[0].open.attrs.opacity)).toBe(1);
      expect(Number(raw.eyes[0].arc.attrs.opacity)).toBe(0);
    }
  });

  it('thinking eyes scan side to side', () => {
    const { engine, raw } = make();
    engine.setState('thinking', false);
    const xs: number[] = [];
    for (let t = 0; t < 3000; t += 16) {
      engine.step(16, false, 0);
      xs.push(translate(raw.eyes[0].g.attrs.transform)?.[0] ?? 0);
    }
    const tail = xs.slice(60);
    expect(Math.max(...tail) - Math.min(...tail)).toBeGreaterThan(2);
  });
});

describe('RendaEngine motion', () => {
  it('thinking turns violet and bounces its dots', () => {
    const { engine, raw } = make();
    engine.setState('thinking', false);
    run(engine, 1500);
    expect(raw.shape.attrs.fill).toBe('#8b5cf6');
    expect(Number(raw.dots.attrs.opacity)).toBeGreaterThan(0.95);
    const before = raw.dot[0].attrs.transform;
    run(engine, 200);
    expect(raw.dot[0].attrs.transform).not.toBe(before);
    expect(engine.isQuiescent(false, 0)).toBe(false);
  });

  it('idle bobs and sways the body', () => {
    const { engine, raw } = make();
    const seen = new Set<string>();
    for (let t = 0; t < 2000; t += 100) {
      run(engine, 100);
      seen.add(raw.body.attrs.transform);
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(raw.body.attrs.transform).toMatch(/rotate\(-?[\d.]+\)/);
  });

  it('the silhouette deforms over time while idle', () => {
    const { engine, raw } = make();
    run(engine, 500);
    const a = raw.shape.attrs.d;
    run(engine, 1000);
    expect(raw.shape.attrs.d).not.toBe(a);
    expect(raw.shape.attrs.d).not.toBe(RENDA_REST_PATH);
  });

  it('listening shows pulsing ticks and returns to blue', () => {
    const { engine, raw } = make();
    engine.setState('listening', false);
    run(engine, 1000);
    expect(Number(raw.ticks.attrs.opacity)).toBeGreaterThan(0.4);
    expect(raw.shape.attrs.fill).toBe('#2f6bff');
  });

  it('success pulses: motes and one outward ripple, then they clear', () => {
    const { engine, raw } = make();
    engine.setState('success', false);
    run(engine, 300);
    expect(raw.sparks.some((s) => Number(s.attrs.opacity) > 0)).toBe(true);
    expect(Number(raw.ripples[0].attrs.opacity)).toBeGreaterThan(0);
    expect(raw.ripples[1].attrs.opacity).toBe('0');
    run(engine, 1400);
    expect(raw.sparks.every((s) => s.attrs.opacity === '0')).toBe(true);
  });

  it('attention plays two ripples', () => {
    const { engine, raw } = make('idle', 'launcher');
    engine.setState('attention', false);
    run(engine, 500);
    expect(Number(raw.ripples[1].attrs.opacity)).toBeGreaterThan(0);
  });
});

describe('RendaEngine battery', () => {
  it('idle hero settles after 20 s without interaction, then stops writing to the DOM', () => {
    const { engine, totalWrites } = make();
    run(engine, 2000);
    let quiet = false;
    for (let t = 0; t < 6000 && !quiet; t += 16) {
      engine.step(16, false, SETTLE_AFTER_MS + 1);
      quiet = engine.isQuiescent(false, SETTLE_AFTER_MS + 1);
    }
    expect(quiet).toBe(true);
    const writes = totalWrites();
    engine.step(16, false, SETTLE_AFTER_MS + 1);
    expect(totalWrites()).toBe(writes);
  });

  it('reduce motion: a still pose; thinking still reads (violet, dots, eyes up-right)', () => {
    const { engine, raw } = make();
    engine.setState('thinking', true);
    engine.step(0, true, 0);
    expect(raw.eyes[0].g.attrs.transform).toBe('translate(2 -2)');
    expect(raw.dots.attrs.opacity).toBe('1');
    expect(raw.shape.attrs.fill).toBe('#8b5cf6');
    expect(raw.body.attrs.transform).toContain('scale(1 1)');
    expect(raw.shape.attrs.d).toBe(RENDA_REST_PATH);
    expect(engine.isQuiescent(true, 0)).toBe(true);
  });
});
