import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RentalInspectionEvidenceBucketStack } from './rental-inspection-evidence-bucket';
import {
  parseObjectLockRetentionDays,
  RENTAL_INSPECTION_EVIDENCE_ACCESS_POLICY_NAME,
  RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME,
  RENTAL_INSPECTION_EVIDENCE_CORS_HEADERS,
  RENTAL_INSPECTION_EVIDENCE_CORS_METHODS,
  RENTAL_INSPECTION_EVIDENCE_CORS_ORIGINS,
  RENTAL_INSPECTION_EVIDENCE_PREFIX,
  RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS,
} from './rental-inspection-evidence-config';

const ACCOUNT = '235680477887';
const REGION = 'ca-central-1';

function synthStack(
  extra?: { objectLockRetentionDays?: number; context?: Record<string, unknown> }
): Template {
  const app = new cdk.App({ context: extra?.context });
  const stack = new RentalInspectionEvidenceBucketStack(app, 'EvidenceTest', {
    env: { account: ACCOUNT, region: REGION },
    objectLockRetentionDays: extra?.objectLockRetentionDays,
  });
  return Template.fromStack(stack);
}

describe('parseObjectLockRetentionDays', () => {
  it('treats empty values as no default retention', () => {
    expect(parseObjectLockRetentionDays(undefined)).toBeUndefined();
    expect(parseObjectLockRetentionDays(null)).toBeUndefined();
    expect(parseObjectLockRetentionDays('')).toBeUndefined();
    expect(parseObjectLockRetentionDays('  ')).toBeUndefined();
    expect(RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS).toBeUndefined();
  });

  it('accepts a positive integer of days', () => {
    expect(parseObjectLockRetentionDays(30)).toBe(30);
    expect(parseObjectLockRetentionDays('90')).toBe(90);
  });

  it('rejects a hardcoded-looking zero or non-integer', () => {
    expect(() => parseObjectLockRetentionDays(0)).toThrow(/positive integer/);
    expect(() => parseObjectLockRetentionDays('365.5')).toThrow(/positive integer/);
  });
});

describe('RentalInspectionEvidenceBucketStack', () => {
  it('creates the named prod bucket with Object Lock, versioning, BPA, SSE-S3, and RETAIN', () => {
    const template = synthStack();
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME,
      ObjectLockEnabled: true,
      VersioningConfiguration: { Status: 'Enabled' },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  it('does not set a default Object Lock retention when config is empty', () => {
    const template = synthStack();
    const buckets = template.findResources('AWS::S3::Bucket');
    const bucket = Object.values(buckets)[0] as {
      Properties?: { ObjectLockConfiguration?: unknown };
    };
    expect(bucket.Properties?.ObjectLockConfiguration).toBeUndefined();
    const raw = JSON.stringify(template.toJSON());
    expect(raw).not.toContain('DefaultRetention');
    expect(raw).not.toContain('GOVERNANCE');
  });

  it('applies GOVERNANCE default retention only when days are configured', () => {
    const template = synthStack({ objectLockRetentionDays: 30 });
    template.hasResourceProperties('AWS::S3::Bucket', {
      ObjectLockEnabled: true,
      ObjectLockConfiguration: {
        ObjectLockEnabled: 'Enabled',
        Rule: {
          DefaultRetention: { Mode: 'GOVERNANCE', Days: 30 },
        },
      },
    });
  });

  it('denies insecure transport', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            Effect: 'Deny',
          }),
        ]),
      },
    });
  });

  it('denies DeleteObject, DeleteObjectVersion, and BypassGovernanceRetention except the account root', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'DenyEvidenceDeleteExceptAccountRoot',
            Effect: 'Deny',
            Action: Match.arrayWith([
              's3:DeleteObject',
              's3:DeleteObjectVersion',
              's3:BypassGovernanceRetention',
            ]),
            Condition: {
              ArnNotEquals: {
                'aws:PrincipalArn': `arn:aws:iam::${ACCOUNT}:root`,
              },
            },
          }),
        ]),
      },
    });
  });

  it('creates an unattached managed policy with PutObject and GetObject only', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: RENTAL_INSPECTION_EVIDENCE_ACCESS_POLICY_NAME,
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:GetObject'],
            Resource: `arn:aws:s3:::${RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME}/${RENTAL_INSPECTION_EVIDENCE_PREFIX}*`,
          }),
        ],
      },
    });
    const policies = template.findResources('AWS::IAM::ManagedPolicy');
    const policy = Object.values(policies)[0] as {
      Properties?: {
        Users?: unknown;
        Roles?: unknown;
        Groups?: unknown;
        PolicyDocument?: { Statement?: Array<{ Action?: unknown }> };
      };
    };
    expect(policy.Properties?.Users).toBeUndefined();
    expect(policy.Properties?.Roles).toBeUndefined();
    expect(policy.Properties?.Groups).toBeUndefined();
    const actions = JSON.stringify(policy.Properties?.PolicyDocument ?? {});
    expect(actions).not.toContain('DeleteObject');
    expect(actions).not.toContain('PutObjectRetention');
    expect(actions).not.toContain('BypassGovernanceRetention');
    expect(actions).not.toContain('ListBucket');
  });

  it('allows browser PUT/GET/HEAD from production web origins', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: Match.arrayWith([
          Match.objectLike({
            AllowedOrigins: [...RENTAL_INSPECTION_EVIDENCE_CORS_ORIGINS],
            AllowedMethods: [...RENTAL_INSPECTION_EVIDENCE_CORS_METHODS],
            AllowedHeaders: [...RENTAL_INSPECTION_EVIDENCE_CORS_HEADERS],
            ExposedHeaders: ['ETag'],
          }),
        ]),
      },
    });
  });

  it('does not enable auto-delete of objects', () => {
    const template = synthStack();
    const raw = JSON.stringify(template.toJSON());
    expect(raw).not.toContain('AutoDeleteObjects');
    expect(raw).not.toContain('Custom::S3AutoDeleteObjects');
  });
});
