import { photoCaption, photoCaptionSx } from './pickupPhotoTime';

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