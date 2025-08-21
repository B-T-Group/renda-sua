import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface RendasuaInfrastructureStackProps extends cdk.StackProps {
  environment: string;
}

export class RendasuaInfrastructureStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: RendasuaInfrastructureStackProps
  ) {
    super(scope, id, props);

    const { environment } = props;

    // Create Lambda layer for requests dependency
    const requestsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      `RequestsLayer-${environment}`,
      'arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p39-requests:1'
    );

    // Create the mobile payments key refresh Lambda function
    const refreshMobilePaymentsKeyFunction = new lambda.Function(
      this,
      `RefreshMobilePaymentsKey-${environment}`,
      {
        functionName: `refresh-mobile-payments-key-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'refresh-mobile-payments-key.handler',
        code: lambda.Code.fromAsset('src/lambda'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        layers: [requestsLayer],
        environment: {
          ENVIRONMENT: environment,
          OPERATION_ACCOUNT_CODE: 'ACC_68A722C33473B', // Replace with actual operation account code
          RECEPTION_URL_CODE: 'TRUVU', // Replace with actual reception URL code
        },
      }
    );

    // Add comprehensive permissions for Secrets Manager
    refreshMobilePaymentsKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
          'secretsmanager:ListSecrets',
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:development-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:production-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:staging-rendasua-backend-secrets*`,
        ],
      })
    );

    // Add CloudWatch Logs permissions for better logging
    refreshMobilePaymentsKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${refreshMobilePaymentsKeyFunction.functionName}:*`,
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${refreshMobilePaymentsKeyFunction.functionName}`,
        ],
      })
    );

    // Create EventBridge rule to trigger the function every 45 minutes
    const refreshKeyRule = new events.Rule(
      this,
      `RefreshMobilePaymentsKeyRule-${environment}`,
      {
        ruleName: `refresh-mobile-payments-key-rule-${environment}`,
        description: 'Triggers mobile payments key refresh every 45 minutes',
        schedule: events.Schedule.rate(cdk.Duration.minutes(45)),
        targets: [
          new targets.LambdaFunction(refreshMobilePaymentsKeyFunction, {
            retryAttempts: 3,
          }),
        ],
      }
    );

    // Grant EventBridge permission to invoke the Lambda function
    refreshMobilePaymentsKeyFunction.addPermission('EventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    // Output the function ARN
    new cdk.CfnOutput(
      this,
      `RefreshMobilePaymentsKeyFunctionArn-${environment}`,
      {
        value: refreshMobilePaymentsKeyFunction.functionArn,
        description: 'ARN of the mobile payments key refresh Lambda function',
        exportName: `RefreshMobilePaymentsKeyFunctionArn-${environment}`,
      }
    );

    // Output the function name
    new cdk.CfnOutput(
      this,
      `RefreshMobilePaymentsKeyFunctionName-${environment}`,
      {
        value: refreshMobilePaymentsKeyFunction.functionName,
        description: 'Name of the mobile payments key refresh Lambda function',
        exportName: `RefreshMobilePaymentsKeyFunctionName-${environment}`,
      }
    );

    // Output the EventBridge rule ARN
    new cdk.CfnOutput(this, `RefreshMobilePaymentsKeyRuleArn-${environment}`, {
      value: refreshKeyRule.ruleArn,
      description: 'ARN of the mobile payments key refresh EventBridge rule',
      exportName: `RefreshMobilePaymentsKeyRuleArn-${environment}`,
    });
  }
}
