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
  ].map((dir) => path.join(process.cwd(), dir));
  const rootLambdaDir = path.join(process.cwd(), 'src/lambda');
  const dockerAssetDir = path.join(process.cwd(), 'src/lambda/rembg-cleanup-handler');
  const dockerfile = path.join(dockerAssetDir, 'Dockerfile');

  beforeAll(() => {
    fs.mkdirSync(layerDir, { recursive: true });
    for (const file of layerFiles) {
      if (!fs.existsSync(file)) fs.writeFileSync(file, '');
    }
    fs.mkdirSync(rootLambdaDir, { recursive: true });
    fs.mkdirSync(dockerAssetDir, { recursive: true });
    fs.writeFileSync(dockerfile, 'FROM scratch\n');
    for (const dir of lambdaDirs) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'handler.py'), 'def handler(event, context): return {}');
    }
  });

  afterAll(() => {
    if (fs.existsSync(dockerfile)) fs.unlinkSync(dockerfile);
    if (fs.existsSync(dockerAssetDir) && fs.readdirSync(dockerAssetDir).length === 0) {
      fs.rmdirSync(dockerAssetDir);
    }
    for (const dir of lambdaDirs) {
      const handler = path.join(dir, 'handler.py');
      if (fs.existsSync(handler)) fs.unlinkSync(handler);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    }
    for (const file of layerFiles) {
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

    // Check that Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'refresh-airtel-mobile-payments-key-test',
      Runtime: 'python3.11',
      Handler: 'refresh-airtel-mobile-payments-key.handler',
      Timeout: 300,
      MemorySize: 256,
    });

    // Check that EventBridge rule is created
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

    // Check that IAM policy allows Secrets Manager access
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
});
