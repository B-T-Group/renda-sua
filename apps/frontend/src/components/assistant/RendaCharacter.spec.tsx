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
    [160, 'expressive', 2, 2],
    [40, 'expressive', 2, 2],
    [28, 'dot', 2, 0],
    [16, 'none', 0, 0],
  ])('derives eyes from size %i → %s', (size, eyes, pills, arcs) => {
    const { container } = render(<RendaCharacter size={size} />);
    const svg = svgOf(container);
    expect(svg.getAttribute('data-renda-eyes')).toBe(eyes);
    expect(svg.querySelectorAll('[data-r="open"]')).toHaveLength(pills);
    expect(svg.querySelectorAll('[data-r="arc"]')).toHaveLength(arcs);
  });

  it('runs the animation loop when motion is allowed', () => {
    mockReducedMotion(false);
    render(<RendaCharacter size={160} state="idle" />);
    expect(rafSpy).toHaveBeenCalled();
  });

  it('reduce motion: still pose (no loop), but the eye shape still switches per state', () => {
    mockReducedMotion(true);
    const { container, rerender } = render(<RendaCharacter size={160} state="idle" />);
    const svg = svgOf(container);
    expect(svg.getAttribute('data-renda-motion')).toBe('reduced');
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('open');
    expect(openEye(svg).getAttribute('opacity')).toBe('1');
    expect(arcEye(svg).getAttribute('opacity')).toBe('0');

    act(() => rerender(<RendaCharacter size={160} state="thinking" />));
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('open');
    // Thinking still reads without motion: eyes up-right, violet body, static dots.
    expect(svg.querySelector('[data-r="eye"]')?.getAttribute('transform')).toBe('translate(2 -2)');
    expect(svg.querySelector('[data-r="dots"]')?.getAttribute('opacity')).toBe('1');
    expect(svg.querySelector('[data-r="shape"]')?.getAttribute('fill')).toBe('#8b5cf6');
    // No breath or float: the body is at rest.
    expect(svg.querySelector('[data-r="body"]')?.getAttribute('transform')).toContain('scale(1 1)');

    act(() => rerender(<RendaCharacter size={160} state="success" />));
    expect(svg.getAttribute('data-renda-eye-shape')).toBe('arc');
    expect(arcEye(svg).getAttribute('opacity')).toBe('1');
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

  it('the animated character is solid fills only (no gradients, filters, masks or clips) and compact', () => {
    const { container } = render(<RendaCharacter size={160} />);
    const svg = svgOf(container);
    expect(
      svg.querySelectorAll('linearGradient, radialGradient, filter, mask, clipPath, use, [id]').length
    ).toBe(0);
    expect(svg.querySelectorAll('*').length).toBeLessThan(40);
  });

  it('static avatars are lightweight: solid fills, no gradients, filters or clip paths', () => {
    const { container } = render(<RendaCharacter size={28} surface="avatar" animated={false} />);
    const svg = svgOf(container);
    expect(svg.querySelectorAll('linearGradient, radialGradient, filter, mask, use, clipPath').length).toBe(0);
    expect(svg.querySelectorAll('*').length).toBeLessThan(8);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('data-renda-eyes')).toBe('dot');
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('100 message avatars stay under 2,000 SVG nodes in total', () => {
    const { container } = render(
      <div>
        {Array.from({ length: 100 }, (_, i) => (
          <RendaCharacter key={i} size={28} surface="avatar" animated={false} />
        ))}
      </div>
    );
    expect(container.querySelectorAll('svg *').length).toBeLessThan(2000);
  });
});
