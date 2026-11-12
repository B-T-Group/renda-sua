import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import {
  parseObjectLockRetentionDays,
  RENTAL_INSPECTION_EVIDENCE_ACCESS_POLICY_NAME,
  RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME,
  RENTAL_INSPECTION_EVIDENCE_CORS_HEADERS,
  RENTAL_INSPECTION_EVIDENCE_CORS_ORIGINS,
  RENTAL_INSPECTION_EVIDENCE_PREFIX,
  RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS,
  RENTAL_INSPECTION_PENDING_PREFIX,
} from './rental-inspection-evidence-config';

export interface RentalInspectionEvidenceBucketStackProps extends cdk.StackProps {
  /**
   * GOVERNANCE default retention in days.
   * Undefined/empty → Object Lock on, no default retention.
   */
  readonly objectLockRetentionDays?: number;
}

export class RentalInspectionEvidenceBucketStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly accessPolicy: iam.ManagedPolicy;

  constructor(
    scope: Construct,
    id: string,
    props?: RentalInspectionEvidenceBucketStackProps
  ) {
    super(scope, id, props);
    const retentionDays = this.resolveRetentionDays(props);
    this.bucket = this.createBucket(retentionDays);
    this.denyDeletesExceptAccountRoot(this.bucket);
    this.denyUnconditionalPutOnFinalKeys(this.bucket);
    this.accessPolicy = this.createUnattachedAccessPolicy();
    this.outputBucketName();
  }

  private resolveRetentionDays(
    props?: RentalInspectionEvidenceBucketStackProps
  ): number | undefined {
    return parseObjectLockRetentionDays(
      props?.objectLockRetentionDays ??
        this.node.tryGetContext('rentalInspectionObjectLockRetentionDays') ??
        RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS
    );
  }

  private createBucket(retentionDays: number | undefined): s3.Bucket {
    return new s3.Bucket(this, 'RentalInspectionEvidence', {
      bucketName: RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME,
      objectLockEnabled: true,
      objectLockDefaultRetention: this.governanceRetention(retentionDays),
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      cors: [this.browserUploadCorsRule()],
      // A future default retention must not lock pending objects. Governance
      // retention would keep staging PUTs past this expiry.
      lifecycleRules: this.pendingUploadLifecycle(),
    });
  }

  private pendingUploadLifecycle(): s3.LifecycleRule[] {
    const prefix = RENTAL_INSPECTION_PENDING_PREFIX;
    return [
      {
        id: 'expire-pending-inspection-uploads',
        prefix,
        expiration: cdk.Duration.days(2),
        noncurrentVersionExpiration: cdk.Duration.days(1),
      },
      {
        id: 'expire-pending-inspection-delete-markers',
        prefix,
        expiredObjectDeleteMarker: true,
      },
    ];
  }

  private governanceRetention(
    retentionDays: number | undefined
  ): s3.ObjectLockRetention | undefined {
    if (retentionDays === undefined) return undefined;
    return s3.ObjectLockRetention.governance(cdk.Duration.days(retentionDays));
  }

  private browserUploadCorsRule(): s3.CorsRule {
    return {
      id: 'rental-inspection-evidence-browser-uploads',
      allowedOrigins: [...RENTAL_INSPECTION_EVIDENCE_CORS_ORIGINS],
      allowedMethods: [
        s3.HttpMethods.PUT,
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
      ],
      allowedHeaders: [...RENTAL_INSPECTION_EVIDENCE_CORS_HEADERS],
      exposedHeaders: ['ETag'],
      maxAge: 3600,
    };
  }

  private denyDeletesExceptAccountRoot(bucket: s3.Bucket): void {
    const accountRootArn = `arn:aws:iam::${this.account}:root`;
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyEvidenceDeleteExceptAccountRoot',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: [
          's3:DeleteObject',
          's3:DeleteObjectVersion',
          's3:BypassGovernanceRetention',
        ],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        conditions: {
          ArnNotEquals: { 'aws:PrincipalArn': accountRootArn },
        },
      })
    );
  }

  /**
   * Final keys (and derivatives) cannot be overwritten. Pending PUTs stay
   * unconditional so a browser can retry the same staging key.
   * DEV buckets do not have this statement.
   */
  private denyUnconditionalPutOnFinalKeys(bucket: s3.Bucket): void {
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyPutWithoutIfNoneMatchExceptPending',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        notResources: [bucket.arnForObjects(`${RENTAL_INSPECTION_PENDING_PREFIX}*`)],
        conditions: {
          Null: { 's3:if-none-match': 'true' },
        },
      })
    );
  }

  private createUnattachedAccessPolicy(): iam.ManagedPolicy {
    const objectArn = `arn:aws:s3:::${RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME}/${RENTAL_INSPECTION_EVIDENCE_PREFIX}*`;
    return new iam.ManagedPolicy(this, 'InspectionEvidenceAccess', {
      managedPolicyName: RENTAL_INSPECTION_EVIDENCE_ACCESS_POLICY_NAME,
      description:
        'Least-privilege rental inspection evidence access for the Lightsail Nest IAM user. Attach as a follow-up; this stack does not attach it to admin or s3User.',
      statements: [this.putGetStatement('InspectionEvidencePutGet', objectArn)],
    });
  }

  private putGetStatement(sid: string, objectArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid,
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [objectArn],
    });
  }

  private outputBucketName(): void {
    new cdk.CfnOutput(this, 'RentalInspectionEvidenceBucketName', {
      value: this.bucket.bucketName,
      description:
        'Prod-only private bucket for rental inspection evidence. Set Nest RENTAL_INSPECTION_BUCKET to this name after deploy.',
    });
  }
}
