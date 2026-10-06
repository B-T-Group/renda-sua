import { brandTokens } from '../../theme/brandTokens';
import {
  RENDA_COLORS,
  RendaEngine,
  RendaNodes,
  RING_WEDGES,
  SWEEP_WEDGES,
  eyeShapeFor,
  eyesForSize,
  stateConfigFor,
} from './rendaCharacterEngine';

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

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
    ['idle', 'arc'],
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

  it('the header avatar ignores attentive/listening and its idle is static', () => {
    expect(eyeShapeFor('header', 'expressive', 'listening')).toBe('arc');
    const idle = stateConfigFor('header', 'expressive', 'idle');
    expect([idle.amp, idle.grad]).toEqual([0, 0]);
    expect(stateConfigFor('header', 'expressive', 'thinking').orbit).toBe(true);
  });

  it('dot and no-eye sizes never morph', () => {
    expect(eyeShapeFor('avatar', 'dot', 'thinking')).toBe('dot');
    expect(eyeShapeFor('hero', 'none', 'thinking')).toBe('none');
    const avatar = stateConfigFor('avatar', 'dot', 'success');
    expect([avatar.amp, avatar.grad]).toEqual([0, 0]);
  });
});

describe('colours (tokens only, no gold or orange)', () => {
  it('builds the palette from brand tokens', () => {
    expect(RENDA_COLORS.main).toBe(brandTokens.primary.main);
    expect(RENDA_COLORS.light).toBe(brandTokens.primary.light);
    expect(RENDA_COLORS.navy).toBe(brandTokens.secondary.main);
    expect(RENDA_COLORS.tint).toBe(brandTokens.tint.primaryStrong);
    expect(RENDA_COLORS.navyEdge.toLowerCase()).toBe('#0a2862');
    // Green appears only in the Success sparkle.
    expect(RENDA_COLORS.sparkCore).toBe(brandTokens.cta.main);
    expect(RENDA_COLORS.sparkLight).toBe(brandTokens.cta.light);
  });

  it('ring and sweep are blue (blue channel dominates; never warm)', () => {
    for (const w of [...RING_WEDGES, ...SWEEP_WEDGES]) {
      const [r, g, b] = rgb(w.fill);
      expect(b).toBeGreaterThanOrEqual(r);
      expect(b).toBeGreaterThanOrEqual(g);
    }
    expect(RING_WEDGES).toHaveLength(120);
  });
});

describe('RendaEngine blinks', () => {
  const el = () => {
    const attrs: Record<string, string> = {};
    return {
      attrs,
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    };
  };
  function fakeNodes() {
    const open = el();
    return {
      open,
      nodes: {
        body: el(),
        halo: el(),
        bloom: el(),
        bloomRot: el(),
        ringRot: el(),
        echoes: el(),
        echoG: [el(), el(), el()],
        sweep: el(),
        sweepRot: el(),
        orbits: el(),
        orbitRot: [el(), el()],
        eyes: [{ g: el(), open, arc: el() }],
        sparks: [],
        ripples: [],
      } as unknown as RendaNodes,
    };
  }

  it('a character that mounts already Attentive still blinks (first blink within ~1 s)', () => {
    const { nodes, open } = fakeNodes();
    const engine = new RendaEngine(
      nodes,
      { size: 160, eyes: 'expressive', surface: 'hero' },
      'attentive',
      () => 0
    );
    expect(engine.isQuiescent(false, 0)).toBe(false);
    let minScaleY = 1;
    for (let t = 0; t < 1000; t += 16) {
      engine.step(16, false, 0);
      const m = /scale\(1 ([\d.]+)\)/.exec(open.attrs.transform || '');
      if (m) minScaleY = Math.min(minScaleY, Number(m[1]));
    }
    expect(minScaleY).toBeLessThan(0.5);
  });
});
