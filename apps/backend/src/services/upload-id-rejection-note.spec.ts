jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
import {
  formatIdRejectionNote,
  ID_REJECTION_NOTE_PREFIX,
  parseIdRejectionReason,
} from './upload.service';

describe('ID rejection note helpers', () => {
  describe('formatIdRejectionNote', () => {
    it('prefixes a plain rejection reason', () => {
      expect(formatIdRejectionNote('Blurry photo')).toBe(
        `${ID_REJECTION_NOTE_PREFIX}Blurry photo`
      );
    });

    it('trims whitespace before prefixing', () => {
      expect(formatIdRejectionNote('  Expired ID  ')).toBe(
        `${ID_REJECTION_NOTE_PREFIX}Expired ID`
      );
    });

    it('does not double-prefix an already formatted note', () => {
      const already = `${ID_REJECTION_NOTE_PREFIX}Not readable`;
      expect(formatIdRejectionNote(already)).toBe(already);
    });
  });

  describe('parseIdRejectionReason', () => {
    it('returns null for empty or whitespace notes', () => {
      expect(parseIdRejectionReason(null)).toBeNull();
      expect(parseIdRejectionReason(undefined)).toBeNull();
      expect(parseIdRejectionReason('')).toBeNull();
      expect(parseIdRejectionReason('   ')).toBeNull();
    });

    it('strips the rejection prefix for display', () => {
      expect(
        parseIdRejectionReason(`${ID_REJECTION_NOTE_PREFIX}Blurry photo`)
      ).toBe('Blurry photo');
    });

    it('treats legacy plain notes as rejection reasons', () => {
      expect(parseIdRejectionReason('Document expired')).toBe(
        'Document expired'
      );
    });

    it('keeps the full note when the prefix has no reason body', () => {
      expect(parseIdRejectionReason(ID_REJECTION_NOTE_PREFIX)).toBe(
        ID_REJECTION_NOTE_PREFIX.trim()
      );
    });
  });
});
