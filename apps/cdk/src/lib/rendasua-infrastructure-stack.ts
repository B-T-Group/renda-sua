import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
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

    // Create the mobile payments key refresh Lambda function
    const refreshMobilePaymentsKeyFunction = new lambda.Function(
      this,
      `RefreshMobilePaymentsKey-${environment}`,
      {
        functionName: `refresh-mobile-payments-key-${environment}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'refresh-mobile-payments-key.handler',
        code: lambda.Code.fromAsset('../lambda'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          ENVIRONMENT: environment,
          OPERATION_ACCOUNT_CODE: 'ACC_68A722C33473B', // Replace with actual operation account code
          RECEPTION_URL_CODE: 'TRUVU', // Replace with actual reception URL code
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
      }
    );

    // Add permissions for Secrets Manager
    refreshMobilePaymentsKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:development-rendasua-backend-secrets*`,
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
      sourceArn: refreshKeyRule.ruleArn,
    });

    // Create CloudWatch Log Group for the function
    new logs.LogGroup(this, `RefreshMobilePaymentsKeyLogGroup-${environment}`, {
      logGroupName: `/aws/lambda/${refreshMobilePaymentsKeyFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
