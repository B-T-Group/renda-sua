import {
  businessNeedsAttention,
  matchesIdDocumentStatusFilter,
  resolveIdDocumentStatus,
} from './admin-business-id-filter.util';

describe('admin-business-id-filter.util', () => {
  describe('resolveIdDocumentStatus', () => {
    it('returns missing when there are no uploads', () => {
      expect(resolveIdDocumentStatus([])).toBe('missing');
    });

    it('returns approved when any upload is approved', () => {
      expect(
        resolveIdDocumentStatus([
          { is_approved: false, note: '[REJECTED] blurry' },
          { is_approved: true, note: null },
        ])
      ).toBe('approved');
    });

    it('returns rejected when latest has a note and none approved', () => {
      expect(
        resolveIdDocumentStatus([
          { is_approved: false, note: '[REJECTED] name mismatch' },
        ])
      ).toBe('rejected');
    });

    it('returns pending when uploads exist without approval or note', () => {
      expect(
        resolveIdDocumentStatus([{ is_approved: false, note: null }])
      ).toBe('pending');
      expect(
        resolveIdDocumentStatus([{ is_approved: false, note: '   ' }])
      ).toBe('pending');
    });
  });

  describe('matchesIdDocumentStatusFilter', () => {
    it('matches exact status', () => {
      expect(matchesIdDocumentStatusFilter([], 'missing')).toBe(true);
      expect(matchesIdDocumentStatusFilter([], 'pending')).toBe(false);
      expect(
        matchesIdDocumentStatusFilter(
          [{ is_approved: false, note: null }],
          'pending'
        )
      ).toBe(true);
    });

    it('not_approved matches missing, pending, and rejected', () => {
      expect(matchesIdDocumentStatusFilter([], 'not_approved')).toBe(true);
      expect(
        matchesIdDocumentStatusFilter(
          [{ is_approved: false, note: null }],
          'not_approved'
        )
      ).toBe(true);
      expect(
        matchesIdDocumentStatusFilter(
          [{ is_approved: false, note: '[REJECTED] x' }],
          'not_approved'
        )
      ).toBe(true);
      expect(
        matchesIdDocumentStatusFilter(
          [{ is_approved: true, note: null }],
          'not_approved'
        )
      ).toBe(false);
    });
  });

  describe('businessNeedsAttention', () => {
    it('flags non-active lifecycle regardless of ID', () => {
      expect(
        businessNeedsAttention('created', [{ is_approved: true }])
      ).toBe(true);
      expect(
        businessNeedsAttention('contract_signed', [{ is_approved: true }])
      ).toBe(true);
      expect(businessNeedsAttention('suspended', [])).toBe(true);
    });

    it('flags active businesses without approved ID', () => {
      expect(businessNeedsAttention('active', [])).toBe(true);
      expect(
        businessNeedsAttention('active', [{ is_approved: false, note: null }])
      ).toBe(true);
      expect(
        businessNeedsAttention('active', [
          { is_approved: false, note: '[REJECTED] unclear' },
        ])
      ).toBe(true);
    });

    it('does not flag active businesses with approved ID', () => {
      expect(
        businessNeedsAttention('active', [{ is_approved: true, note: null }])
      ).toBe(false);
    });
  });
});
