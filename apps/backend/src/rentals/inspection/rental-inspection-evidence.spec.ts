import {
  INSPECTION_EVIDENCE_BUCKET,
  INSPECTION_UPLOAD_TTL_SECONDS,
  INSPECTION_VIEW_TTL_SECONDS,
  inspectionChecksumHeader,
  inspectionDerivativeKey,
  inspectionEvidenceBucket,
  inspectionKeyRoot,
  inspectionObjectKey,
  inspectionPendingObjectKey,
  isInspectionEvidenceKey,
  isInspectionPendingKey,
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

  it('lowercases booking ids before they are written into the object key', () => {
    const key = inspectionObjectKey(booking.toUpperCase(), media.toUpperCase(), 'jpg', 'development');
    expect(key).toBe(`dev/rental-inspection/${booking}/${media}.jpg`);
    expect(isInspectionEvidenceKey(key, booking.toUpperCase())).toBe(true);
  });

  it('presigns a pending key that cannot be treated as evidence', () => {
    const pending = inspectionPendingObjectKey(booking, media, 'jpg', 'production');
    expect(pending).toBe(`prod/rental-inspection/pending/${booking}/${media}.jpg`);
    expect(isInspectionPendingKey(pending, booking)).toBe(true);
    expect(isInspectionEvidenceKey(pending, booking)).toBe(false);
    expect(isInspectionPendingKey(inspectionObjectKey(booking, media, 'jpg', 'production'), booking)).toBe(
      false
    );
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

  it('turns a hex sha256 into the checksum header browsers must send', () => {
    const hex = 'ab'.repeat(32);
    expect(inspectionChecksumHeader(hex)).toBe(Buffer.from(hex, 'hex').toString('base64'));
    expect(() => inspectionChecksumHeader('abcd')).toThrow();
  });

  it('keeps DEV on the shared uploads bucket and lets prod set RENTAL_INSPECTION_BUCKET', () => {
    expect(inspectionEvidenceBucket({})).toBe('rendasua-user-uploads');
    expect(inspectionEvidenceBucket({ RENTAL_INSPECTION_BUCKET: '  ' })).toBe(
      'rendasua-user-uploads'
    );
    expect(
      inspectionEvidenceBucket({ APPEAL_EVIDENCE_BUCKET: 'rs-private-evidence' })
    ).toBe('rs-private-evidence');
    expect(
      inspectionEvidenceBucket({
        APPEAL_EVIDENCE_BUCKET: 'rs-private-evidence',
        RENTAL_INSPECTION_BUCKET: 'rendasua-rental-inspection-evidence-prod',
      })
    ).toBe('rendasua-rental-inspection-evidence-prod');
  });
});

describe('final inspection writes do not overwrite', () => {
  it('sends If-None-Match only when the caller asks for a create', async () => {
    const { AwsService } = require('../../aws/aws.service');
    const svc = new AwsService({
      get: () => ({ region: 'ca-central-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'test-only' }),
    });
    const send = jest.fn().mockResolvedValue({ VersionId: 'v1' });
    (svc as { s3Client: { send: jest.Mock } }).s3Client = { send };
    await svc.putPrivateObject('rendasua-user-uploads', 'dev/rental-inspection/b/m.jpg', Buffer.from('a'), 'image/jpeg', {
      ifNoneMatch: true,
    });
    await svc.putPrivateObject('rendasua-user-uploads', 'other/key.jpg', Buffer.from('a'), 'image/jpeg');
    expect(send.mock.calls[0][0].input.IfNoneMatch).toBe('*');
    expect(send.mock.calls[1][0].input.IfNoneMatch).toBeUndefined();
  });

  it('signs the sha256 checksum into the browser PUT', async () => {
    const { AwsService } = require('../../aws/aws.service');
    const { inspectionChecksumHeader } = require('./rental-inspection-evidence');
    const svc = new AwsService({
      get: () => ({ region: 'ca-central-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'test-only' }),
    });
    const checksum = inspectionChecksumHeader('cd'.repeat(32));
    const out = await svc.generateStrictUploadUrl({
      bucketName: 'rendasua-user-uploads',
      key: 'dev/rental-inspection/pending/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg',
      contentType: 'image/jpeg',
      contentLength: 1200,
      checksumSha256: checksum,
    });
    expect(out.signedHeaders).toEqual(expect.arrayContaining(['x-amz-checksum-sha256', 'content-type', 'content-length']));
  });
});
