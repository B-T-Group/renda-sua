import {
  displayIdRejectionNote,
  ID_REJECTION_NOTE_PREFIX,
  isIdRejectionNote,
} from './idRejectionNote';

describe('idRejectionNote', () => {
  describe('isIdRejectionNote', () => {
    it('is true for any non-empty note (prefixed or legacy)', () => {
      expect(isIdRejectionNote(`${ID_REJECTION_NOTE_PREFIX}Blurry`)).toBe(true);
      expect(isIdRejectionNote('Expired')).toBe(true);
    });

    it('is false for empty notes', () => {
      expect(isIdRejectionNote(null)).toBe(false);
      expect(isIdRejectionNote(undefined)).toBe(false);
      expect(isIdRejectionNote('')).toBe(false);
      expect(isIdRejectionNote('   ')).toBe(false);
    });
  });

  describe('displayIdRejectionNote', () => {
    it('strips the stored rejection marker', () => {
      expect(
        displayIdRejectionNote(`${ID_REJECTION_NOTE_PREFIX}Blurry photo`)
      ).toBe('Blurry photo');
    });

    it('returns legacy plain notes unchanged', () => {
      expect(displayIdRejectionNote('Document expired')).toBe(
        'Document expired'
      );
    });

    it('returns empty string for blank notes', () => {
      expect(displayIdRejectionNote(null)).toBe('');
      expect(displayIdRejectionNote('  ')).toBe('');
    });
  });
});
