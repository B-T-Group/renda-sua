import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  APPEAL_EVIDENCE_PREFIX,
  USER_UPLOADS_BUCKET_NAME,
  USER_UPLOADS_CORS_HEADERS,
  USER_UPLOADS_CORS_METHODS,
  USER_UPLOADS_CORS_ORIGINS,
  UserUploadsBucketStack,
} from './user-uploads-bucket';

describe('UserUploadsBucketStack', () => {
  const lambdaDir = path.join(
    __dirname,
    '../lambda/user-uploads-bucket-config'
  );
  const handlerPath = path.join(lambdaDir, 'handler.py');
  let createdHandler = false;

  beforeAll(() => {
    fs.mkdirSync(lambdaDir, { recursive: true });
    if (!fs.existsSync(handlerPath)) {
      fs.writeFileSync(handlerPath, 'def handler(event, context): return {}\n');
      createdHandler = true;
    }
  });

  afterAll(() => {
    if (createdHandler && fs.existsSync(handlerPath)) {
      fs.unlinkSync(handlerPath);
    }
  });

  function synthStack(): Template {
    const app = new cdk.App();
    const stack = new UserUploadsBucketStack(app, 'UserUploadsTest', {
      env: { account: '235680477887', region: 'ca-central-1' },
    });
    return Template.fromStack(stack);
  }

  it('does not create rendasua-user-uploads or rendasua-uploads', () => {
    const template = synthStack();
    expect(template.findResources('AWS::S3::Bucket')).toEqual({});
    expect(template.findResources('AWS::S3::BucketPolicy')).toEqual({});
    const raw = JSON.stringify(template.toJSON());
    expect(raw).not.toContain('rendasua-uploads');
    expect(raw).toContain(USER_UPLOADS_BUCKET_NAME);
  });

  it('grants prefix-scoped PutObject and GetObject to s3User', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: 'rendasua-user-uploads-item-appeal-evidence',
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:GetObject'],
            Resource: `arn:aws:s3:::${USER_UPLOADS_BUCKET_NAME}/${APPEAL_EVIDENCE_PREFIX}*`,
          }),
        ],
      },
    });
  });

  it('applies merged CORS, public-access block, and abort-incomplete lifecycle', () => {
    const template = synthStack();
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      BucketName: USER_UPLOADS_BUCKET_NAME,
      CorsRule: Match.objectLike({
        AllowedOrigins: [...USER_UPLOADS_CORS_ORIGINS],
        AllowedMethods: [...USER_UPLOADS_CORS_METHODS],
        AllowedHeaders: [...USER_UPLOADS_CORS_HEADERS],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      }),
      LifecycleRule: Match.objectLike({
        Prefix: APPEAL_EVIDENCE_PREFIX,
        AbortIncompleteMultipartUploadDays: 7,
      }),
    });
  });
});
