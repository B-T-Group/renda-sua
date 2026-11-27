import { formatPickupDay, photoCaption, photoCaptionSx } from './pickupPhotoTime';

describe('photo caption', () => {
  it('keeps a space on both sides of the dot', () => {
    expect(photoCaption('New', '14 Nov')).toBe('New · 14 Nov');
    expect(photoCaption('Nouvelle', '14 nov.')).toBe('Nouvelle · 14 nov.');
  });

  it('ellipsizes inside the tile instead of overflowing', () => {
    expect(photoCaptionSx()).toEqual(expect.objectContaining({
      maxWidth: 148,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }));
  });
});

describe('formatPickupDay', () => {
  it('prints the stored UTC date for Douala, Manila afternoon, and Toronto DST', () => {
    expect(formatPickupDay('2026-11-17T08:00:00.000Z', 'en')).toBe('17 Nov');
    expect(formatPickupDay('2026-11-17T08:00:00.000Z', 'fr')).toBe('17 nov.');
    expect(formatPickupDay('2026-11-26T16:00:00.000Z', 'en')).toBe('26 Nov');
    expect(formatPickupDay('2026-03-15T03:59:59.000Z', 'en')).toBe('15 Mar');
    expect(formatPickupDay('2026-11-01T03:59:59.000Z', 'en')).toBe('1 Nov');
  });
});
