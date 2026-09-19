import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RendasuaInfrastructureStack } from './rendasua-infrastructure-stack';

describe('RendasuaInfrastructureStack', () => {
  const layerDir = path.join(process.cwd(), 'src/lambda-layer');
  const layerFiles = ['requests-layer.zip', 'core-packages-layer.zip'].map(
    (name) => path.join(layerDir, name)
  );
  const lambdaDirs = [
    'src/lambda/order-status-handler',
    'src/lambda/rental-listing-ai-review-handler',
    'src/lambda/item-ai-review-handler',
    'src/lambda/admin-broadcast-handler',
    'src/lambda/ai-image-cleanup-handler',
    'src/lambda/image-thumbnails-handler',
    'src/lambda/commerce-sync-handler',
    'src/lambda/wait-handler',
    'src/lambda/notify-agents',
    'src/lambda/business-referral-payouts',
    'src/lambda/payment-schedule-runs',
    'src/lambda/credit-campaign-signup',
    'src/lambda/reel-media-handler',
    'src/lambda/reel-ai-review-handler',
    'src/lambda/sync-backend-reels-secrets',
  ].map((dir) => path.join(process.cwd(), dir));
  const rootLambdaDir = path.join(process.cwd(), 'src/lambda');
  const dockerAssetDir = path.join(
    process.cwd(),
    'src/lambda/rembg-cleanup-handler'
  );
  const dockerfile = path.join(dockerAssetDir, 'Dockerfile');
  const createdHandlers: string[] = [];
  const createdLayers: string[] = [];
  let createdDockerfile = false;

  beforeAll(() => {
    fs.mkdirSync(layerDir, { recursive: true });
    for (const file of layerFiles) {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '');
        createdLayers.push(file);
      }
    }
    fs.mkdirSync(rootLambdaDir, { recursive: true });
    fs.mkdirSync(dockerAssetDir, { recursive: true });
    if (!fs.existsSync(dockerfile)) {
      fs.writeFileSync(dockerfile, 'FROM scratch\n');
      createdDockerfile = true;
    }
    for (const dir of lambdaDirs) {
      fs.mkdirSync(dir, { recursive: true });
      const handler = path.join(dir, 'handler.py');
      if (!fs.existsSync(handler)) {
        fs.writeFileSync(
          handler,
          'def handler(event, context): return {}\n'
        );
        createdHandlers.push(handler);
      }
    }
  });

  afterAll(() => {
    if (createdDockerfile && fs.existsSync(dockerfile)) {
      fs.unlinkSync(dockerfile);
    }
    if (
      fs.existsSync(dockerAssetDir) &&
      fs.readdirSync(dockerAssetDir).length === 0
    ) {
      fs.rmdirSync(dockerAssetDir);
    }
    for (const handler of createdHandlers) {
      if (fs.existsSync(handler)) fs.unlinkSync(handler);
      const dir = path.dirname(handler);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    }
    for (const file of createdLayers) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    if (fs.existsSync(layerDir) && fs.readdirSync(layerDir).length === 0) {
      fs.rmdirSync(layerDir);
    }
  });

  it('creates Lambda function with correct properties', () => {
    const app = new cdk.App();
    const stack = new RendasuaInfrastructureStack(app, 'TestStack', {
      environment: 'test',
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'refresh-airtel-mobile-payments-key-test',
      Runtime: 'python3.11',
      Handler: 'refresh-airtel-mobile-payments-key.handler',
      Timeout: 300,
      MemorySize: 256,
    });

    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'refresh-airtel-mobile-payments-key-rule-test',
      Description: 'Triggers Airtel mobile payments key refresh every 45 minutes',
    });
  });

  it('creates IAM role with correct permissions', () => {
    const app = new cdk.App();
    const stack = new RendasuaInfrastructureStack(app, 'TestStack', {
      environment: 'test',
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith([
              'secretsmanager:GetSecretValue',
              'secretsmanager:DescribeSecret',
            ]),
          }),
        ],
      },
    });
  });

  it('syncs reels bucket outputs into backend secrets', () => {
    const app = new cdk.App();
    const stack = new RendasuaInfrastructureStack(app, 'TestStack', {
      environment: 'test',
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'sync-backend-reels-secrets-test',
      Runtime: 'python3.11',
      Handler: 'handler.handler',
    });
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'rendasua-reels-test',
    });
  });
});
