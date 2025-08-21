import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RendasuaInfrastructureStack } from './rendasua-infrastructure-stack';

describe('RendasuaInfrastructureStack', () => {
  it('creates Lambda function with correct properties', () => {
    const app = new cdk.App();
    const stack = new RendasuaInfrastructureStack(app, 'TestStack', {
      environment: 'test',
    });

    const template = Template.fromStack(stack);

    // Check that Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'refresh-mobile-payments-key-test',
      Runtime: 'nodejs18.x',
      Handler: 'refresh-mobile-payments-key.handler',
      Timeout: 300,
      MemorySize: 256,
    });

    // Check that EventBridge rule is created
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'refresh-mobile-payments-key-rule-test',
      Description: 'Triggers mobile payments key refresh every 45 minutes',
    });

    // Check that CloudWatch Log Group is created
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/refresh-mobile-payments-key-test',
      RetentionInDays: 7,
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
          {
            Effect: 'Allow',
            Action: [
              'secretsmanager:UpdateSecret',
              'secretsmanager:GetSecretValue',
            ],
          },
        ],
      },
    });
  });
});
