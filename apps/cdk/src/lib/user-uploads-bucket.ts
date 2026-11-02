import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/** Shared private bucket for ID documents and appeal evidence (DEV + prod). */
export const USER_UPLOADS_BUCKET_NAME = 'rendasua-user-uploads';

export const APPEAL_EVIDENCE_PREFIX = 'item-appeal-evidence/';

export const APPEAL_EVIDENCE_CORS_RULE_ID = 'item-appeal-evidence-browser-uploads';

export const APPEAL_EVIDENCE_LIFECYCLE_RULE_ID =
  'abort-incomplete-item-appeal-evidence';

/**
 * Browser origins that PUT/GET private objects via presigned URLs.
 * From apps/backend/src/config/cors-origin.ts, frontend env files, and
 * Hasura CORS defaults. Native mobile does not send a browser Origin.
 */
export const USER_UPLOADS_CORS_ORIGINS = [
  'https://www.rendasua.com',
  'https://rendasua.com',
  'https://dev.rendasua.com',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
] as const;

export const USER_UPLOADS_CORS_METHODS = ['PUT', 'GET', 'HEAD'] as const;

export const USER_UPLOADS_CORS_HEADERS = [
  'Content-Type',
  'Content-Length',
] as const;

export interface UserUploadsBucketConfigProps {
  /** Lightsail backend IAM user (same credentials in DEV and prod). */
  readonly backendIamUser?: string;
}

/**
 * Configures the existing `rendasua-user-uploads` bucket in place.
 * Does not create, replace, or delete the bucket.
 *
 * First deploy: `yarn cdk deploy RendasuaUserUploadsBucket` from apps/cdk
 * (no `cdk import` — the bucket is referenced by name, not owned as a CFN
 * AWS::S3::Bucket). The Lambda reads live CORS/lifecycle and merges by rule
 * ID. Stack delete removes only those IDs and leaves Block Public Access on.
 */
export class UserUploadsBucketConfig extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: UserUploadsBucketConfigProps = {}
  ) {
    super(scope, id);

    const backendIamUser = props.backendIamUser || 's3User';
    const bucket = s3.Bucket.fromBucketName(
      this,
      'ImportedUserUploads',
      USER_UPLOADS_BUCKET_NAME
    );

    this.grantAppealEvidenceAccess(backendIamUser, bucket);
    this.addBucketConfigResource(bucket);
  }

  private grantAppealEvidenceAccess(
    backendIamUser: string,
    bucket: s3.IBucket
  ): void {
    const user = iam.User.fromUserName(this, 'BackendAwsUser', backendIamUser);
    // Additive prefix grant only. Does not replace live policies on s3User.
    new iam.Policy(this, 'AppealEvidenceObjectAccess', {
      policyName: 'rendasua-user-uploads-item-appeal-evidence',
      users: [user],
      statements: [
        new iam.PolicyStatement({
          sid: 'AppealEvidencePutGet',
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:GetObject'],
          resources: [
            `arn:aws:s3:::${USER_UPLOADS_BUCKET_NAME}/${APPEAL_EVIDENCE_PREFIX}*`,
          ],
        }),
      ],
    });
  }

  private addBucketConfigResource(bucket: s3.IBucket): void {
    const handler = this.createConfigHandler(bucket);
    const provider = new Provider(this, 'ConfigProvider', {
      onEventHandler: handler,
    });
    new cdk.CustomResource(this, 'ApplyConfig', {
      serviceToken: provider.serviceToken,
      properties: {
        BucketName: bucket.bucketName,
        CorsRule: this.corsRuleProps(),
        LifecycleRule: this.lifecycleRuleProps(),
      },
    });
  }

  private createConfigHandler(bucket: s3.IBucket): lambda.Function {
    const handler = new lambda.Function(this, 'ConfigHandler', {
      functionName: 'rendasua-user-uploads-bucket-config',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambda/user-uploads-bucket-config')
      ),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
    });
    handler.addToRolePolicy(this.bucketConfigPolicy(bucket));
    return handler;
  }

  private bucketConfigPolicy(bucket: s3.IBucket): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutBucketPublicAccessBlock',
        's3:GetBucketPublicAccessBlock',
        's3:GetBucketCors',
        's3:PutBucketCors',
        's3:GetLifecycleConfiguration',
        's3:PutLifecycleConfiguration',
      ],
      resources: [bucket.bucketArn],
    });
  }

  private corsRuleProps() {
    return {
      ID: APPEAL_EVIDENCE_CORS_RULE_ID,
      AllowedOrigins: [...USER_UPLOADS_CORS_ORIGINS],
      AllowedMethods: [...USER_UPLOADS_CORS_METHODS],
      AllowedHeaders: [...USER_UPLOADS_CORS_HEADERS],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    };
  }

  private lifecycleRuleProps() {
    return {
      ID: APPEAL_EVIDENCE_LIFECYCLE_RULE_ID,
      Prefix: APPEAL_EVIDENCE_PREFIX,
      AbortIncompleteMultipartUploadDays: 7,
    };
  }
}

export class UserUploadsBucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new UserUploadsBucketConfig(this, 'UserUploadsBucketConfig', {
      backendIamUser:
        this.node.tryGetContext('backendAwsIamUser') || 's3User',
    });
    new cdk.CfnOutput(this, 'UserUploadsBucketName', {
      value: USER_UPLOADS_BUCKET_NAME,
      description:
        'Existing private bucket (imported). Not created or deleted by this stack.',
    });
  }
}
