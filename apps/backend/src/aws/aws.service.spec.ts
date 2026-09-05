import { ConfigService } from '@nestjs/config';
import { AwsService } from './aws.service';

describe('AwsService presigned upload URLs', () => {
  const service = new AwsService({
    get: jest.fn().mockReturnValue({
      region: 'ca-central-1',
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'test-secret',
    }),
  } as unknown as ConfigService);

  it('does not embed flexible checksums that upload clients omit', async () => {
    const result = await service.generatePresignedUploadUrl({
      bucketName: 'rendasua-user-uploads',
      key: 'business/user/1/agreement.pdf',
      contentType: 'application/pdf',
      metadata: {
        'user-id': 'user-1',
        'user-type': 'business',
        'document-type-id': '23',
        'file-size': '2048',
        'uploaded-at': '2026-08-17T00:00:00.000Z',
      },
    });

    const decoded = decodeURIComponent(result.url);
    expect(decoded).not.toMatch(/x-amz-checksum/i);
    expect(decoded).not.toMatch(/x-amz-sdk-checksum-algorithm/i);
    expect(result.url).toContain('rendasua-user-uploads');
  });
});
