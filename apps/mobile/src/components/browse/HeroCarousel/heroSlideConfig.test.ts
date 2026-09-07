import { describe, expect, it } from 'vitest';
import { buildHeroSlides } from './heroSlideConfig';

describe('buildHeroSlides', () => {
  it('prioritizes merchant slide for sell intent', () => {
    const slides = buildHeroSlides({ personaIntent: 'sell' });
    expect(slides[0]?.id).toBe('grow_business');
  });

  it('prioritizes courier slide for deliver intent', () => {
    const slides = buildHeroSlides({ personaIntent: 'deliver' });
    expect(slides[0]?.id).toBe('become_courier');
  });

  it('hides courier slide for active business persona', () => {
    const slides = buildHeroSlides({
      personaIntent: null,
      activePersona: 'business',
    });
    expect(slides.some((s) => s.id === 'become_courier')).toBe(false);
    expect(slides[0]?.id).toBe('grow_business');
  });

  it('hides mobile money when disabled', () => {
    const slides = buildHeroSlides({
      personaIntent: 'explore',
      showMobileMoney: false,
    });
    expect(slides.some((s) => s.id === 'mobile_money')).toBe(false);
  });
});
