import {
  INSPECTION_EVIDENCE_BUCKET,
  INSPECTION_UPLOAD_TTL_SECONDS,
  INSPECTION_VIEW_TTL_SECONDS,
  inspectionDerivativeKey,
  inspectionKeyRoot,
  inspectionObjectKey,
  isInspectionEvidenceKey,
  validateInspectionUpload,
} from './rental-inspection-evidence';

describe('inspection evidence keys', () => {
  const booking = '11111111-1111-4111-8111-111111111111';
  const media = '22222222-2222-4222-8222-222222222222';

  it('uses a dev prefix outside production and a prod prefix in production', () => {
    expect(inspectionObjectKey(booking, media, 'jpg', 'development')).toBe(
      `dev/rental-inspection/${booking}/${media}.jpg`
    );
    expect(inspectionObjectKey(booking, media, 'jpg', 'production')).toBe(
      `prod/rental-inspection/${booking}/${media}.jpg`
    );
    expect(inspectionKeyRoot('production')).toBe('prod');
  });

  it('accepts only keys we issued for that booking', () => {
    const key = inspectionObjectKey(booking, media, 'png', 'development');
    expect(isInspectionEvidenceKey(key, booking)).toBe(true);
    expect(isInspectionEvidenceKey(key, '33333333-3333-4333-8333-333333333333')).toBe(false);
    expect(isInspectionEvidenceKey(`https://cdn.example/${key}`, booking)).toBe(false);
    expect(isInspectionEvidenceKey(`dev/rental-inspection/${booking}/../secret.jpg`, booking)).toBe(false);
  });

  it('puts the stripped derivative next to the original', () => {
    const key = inspectionObjectKey(booking, media, 'webp', 'production');
    expect(inspectionDerivativeKey(key)).toBe(
      `prod/rental-inspection/${booking}/${media}.view.jpg`
    );
  });

  it('signs a short upload and rejects the wrong type or size', () => {
    expect(INSPECTION_UPLOAD_TTL_SECONDS).toBeLessThanOrEqual(600);
    expect(INSPECTION_VIEW_TTL_SECONDS).toBeLessThanOrEqual(600);
    expect(INSPECTION_EVIDENCE_BUCKET).toBe('rendasua-user-uploads');
    expect(validateInspectionUpload('image/jpg', 1000).contentType).toBe('image/jpeg');
    expect(() => validateInspectionUpload('image/svg+xml', 1000)).toThrow();
    expect(() => validateInspectionUpload('image/jpeg', 9 * 1024 * 1024)).toThrow();
  });
});
