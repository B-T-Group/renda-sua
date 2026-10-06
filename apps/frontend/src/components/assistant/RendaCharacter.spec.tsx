import { act, render } from '@testing-library/react';
import { RendaCharacter } from './RendaCharacter';

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
}

const svgOf = (c: HTMLElement) => c.querySelector('svg[data-renda]') as SVGSVGElement;
const openEye = (svg: SVGSVGElement) => svg.querySelector('[data-r="open"]') as SVGElement;
const arcEye = (svg: SVGSVGElement) => svg.querySelector('[data-r="arc"]') as SVGElement;

let rafSpy: jest.SpyInstance;
beforeEach(() => {
  rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('RendaCharacter', () => {
  it('is decorative: aria-hidden, not focusable, 0 0 82 100 viewBox at width 0.82 × height', () => {
    const { container } = render(<RendaCharacter size={160} />);
    const svg = svgOf(container);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('viewBox')).toBe('0 0 82 100');
    expect(svg.getAttribute('height')).toBe('160');
    expect(svg.getAttribute('width')).toBe('131.2');
  });

  it.each([
    [160, 'expressive', 2, 2, 0],
    [40, 'expressive', 2, 2, 0],
    [28, 'dot', 0, 0, 2],
    [16, 'none', 0, 0, 0],
  ])('derives eyes from size %i → %s', (size, eyes, open, arcs, dots) => {
    const { container } = render(<RendaCharacter size={size} />);
    const svg = svgOf(container);
    expect(svg.getAttribute('data-renda-eyes')).toBe(eyes);
    expect(svg.querySelectorAll('[data-r="open"]')).toHaveLength(open);
    expect(svg.querySelectorAll('[data-r="arc"]')).toHaveLength(arcs);
    expect(svg.querySelectorAll('[data-r="eye"] circle')).toHaveLength(dots);
  });

  it('runs the animation loop when motion is allowed', () => {
    mockReducedMotion(false);
    render(<RendaCharacter size={160} state="idle" />);
    expect(rafSpy).toHaveBeenCalled();
  });

  it('reduce motion: static ring (no loop), but the eye shape still switches per state', () => {
    mockReducedMotion(true);
    const { container, rerender } = render(<RendaCharacter size={160} state="idle" />);
    const svg = svgOf(container);
    expect(svg.getAttribute('data-renda-motion')).toBe('reduced');
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('arc');
    expect(openEye(svg).getAttribute('opacity')).toBe('0');
    expect(arcEye(svg).getAttribute('opacity')).toBe('1');

    act(() => rerender(<RendaCharacter size={160} state="thinking" />));
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('open');
    expect(openEye(svg).getAttribute('opacity')).toBe('1');
    expect(arcEye(svg).getAttribute('opacity')).toBe('0');
    // Thinking looks up-right instantly; no orbit swirls in reduce motion.
    expect(svg.querySelector('[data-r="eye"]')?.getAttribute('transform')).toBe('translate(2 -2)');
    expect(svg.querySelector('[data-r="orbits"]')?.getAttribute('opacity')).toBe('0');
    // No breath: the body is at scale 1.
    expect(svg.querySelector('[data-r="body"]')?.getAttribute('transform')).toContain('scale(1)');

    act(() => rerender(<RendaCharacter size={160} state="success" />));
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('arc');
    // No sparkles in reduce motion.
    svg.querySelectorAll('[data-r="spark"]').forEach((s) => expect(s.getAttribute('opacity')).toBe('0'));
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('animated={false} is static too (message avatars)', () => {
    mockReducedMotion(false);
    const { container } = render(<RendaCharacter size={28} surface="avatar" animated={false} />);
    expect(svgOf(container).getAttribute('data-renda-motion')).toBe('static');
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('gives every instance its own SVG ids', () => {
    const { container } = render(
      <>
        <RendaCharacter size={40} />
        <RendaCharacter size={40} />
      </>
    );
    const ids = Array.from(container.querySelectorAll('mask')).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
