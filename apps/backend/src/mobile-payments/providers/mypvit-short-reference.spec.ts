import { buildShortReferenceForMyPVit } from './mypvit.service';

describe('buildShortReferenceForMyPVit', () => {
  it('generates a reference with max 15 characters', () => {
    const longRef = '71787328-1788646372816-lwu9rr';
    const shortRef = buildShortReferenceForMyPVit(longRef);
    expect(shortRef.length).toBeLessThanOrEqual(15);
  });

  it('generates consistent reference for the same input (deterministic)', () => {
    const longRef = '71787328-1788646372816-lwu9rr';
    const shortRef1 = buildShortReferenceForMyPVit(longRef);
    const shortRef2 = buildShortReferenceForMyPVit(longRef);
    // Should be identical because the function is deterministic
    expect(shortRef1).toBe(shortRef2);
  });

  it('generates different references for different inputs', () => {
    const ref1 = buildShortReferenceForMyPVit('71787328-1788646372816-lwu9rr');
    const ref2 = buildShortReferenceForMyPVit('71787329-1788646372816-xyz123');
    // Different inputs should produce different hashes
    expect(ref1).not.toBe(ref2);
  });

  it('handles very long references', () => {
    const veryLongRef = 'order-123456789-timestamp-1234567890123456-nonce-abcdefghijklmnop';
    const shortRef = buildShortReferenceForMyPVit(veryLongRef);
    expect(shortRef.length).toBeLessThanOrEqual(15);
  });

  it('generates reference starting with M', () => {
    const longRef = '71787328-1788646372816-lwu9rr';
    const shortRef = buildShortReferenceForMyPVit(longRef);
    expect(shortRef).toMatch(/^M[a-z0-9]{13}$/);
  });

  it('uses alphanumeric characters only', () => {
    const longRef = '71787328-1788646372816-lwu9rr';
    const shortRef = buildShortReferenceForMyPVit(longRef);
    expect(shortRef).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('handles empty string gracefully', () => {
    const shortRef = buildShortReferenceForMyPVit('');
    expect(shortRef.length).toBeLessThanOrEqual(15);
  });

  it('handles special characters in input', () => {
    const longRef = 'ref-with-special-chars-!@#$%^&*()';
    const shortRef = buildShortReferenceForMyPVit(longRef);
    expect(shortRef.length).toBeLessThanOrEqual(15);
    expect(shortRef).toMatch(/^[A-Za-z0-9]+$/);
  });

  describe('real-world examples', () => {
    it('handles typical order payment reference', () => {
      const orderRef = '71787328-1788646372816-lwu9rr';
      const shortRef = buildShortReferenceForMyPVit(orderRef);
      expect(shortRef.length).toBeLessThanOrEqual(15);
    });

    it('handles pay-at-pickup reference', () => {
      const pickupRef = '12345678-1788646372816-abc123';
      const shortRef = buildShortReferenceForMyPVit(pickupRef);
      expect(shortRef.length).toBeLessThanOrEqual(15);
    });

    it('handles retry payment reference', () => {
      const retryRef = '99999999-1788646372816-zzz999';
      const shortRef = buildShortReferenceForMyPVit(retryRef);
      expect(shortRef.length).toBeLessThanOrEqual(15);
    });
  });

  describe('MyPVIT API constraint validation', () => {
    it('ensures reference meets MyPVIT 15-char limit', () => {
      // Test with various real-world reference patterns
      const testCases = [
        '71787328-1788646372816-lwu9rr', // 29 chars
        '12345678-1234567890123-abcdef', // 30 chars
        'order-100-timestamp-1234567890-nonce', // 37 chars
        'a'.repeat(50), // 50 chars
        'a'.repeat(100), // 100 chars
      ];

      testCases.forEach((testCase) => {
        const shortRef = buildShortReferenceForMyPVit(testCase);
        expect(shortRef.length).toBeLessThanOrEqual(15);
        expect(shortRef.length).toBeGreaterThan(0);
      });
    });

    it('generates reference that MyPVIT should accept', () => {
      const longRef = '71787328-1788646372816-lwu9rr';
      const shortRef = buildShortReferenceForMyPVit(longRef);
      
      // MyPVIT constraints based on sanitizeFreeInfo pattern
      // (though reference field may have different constraints than free_info)
      expect(shortRef).toMatch(/^[A-Za-z0-9-]+$/);
      expect(shortRef.length).toBeLessThanOrEqual(15);
    });
  });
});
