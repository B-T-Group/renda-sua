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
    const requestsLayer = new lambda.LayerVersion(
      this,
      `RequestsLayer-${environment}`,
      {
        layerVersionName: `requests-layer-${environment}`,
        description: 'Lambda layer containing requests library',
        code: lambda.Code.fromAsset('src/lambda-layer/requests-layer.zip'),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      }
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
          OPERATION_ACCOUNT_CODE:
            environment === 'production'
              ? 'ACC_68B8C1E5663B4'
              : 'ACC_68A722C33473B',
          RECEPTION_URL_CODE: environment === 'production' ? 'BQ1TV' : 'TRUVU',
          MYPVIT_SECRET_KEY_REFRESH_PATH:
            environment === 'production'
              ? 'CJF0DPOVZU87UUK8'
              : 'CTCNJRBWZIDALEGT',
        },
      }
    );

    // Add permissions for Secrets Manager
    refreshMobilePaymentsKeyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:development-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:production-rendasua-backend-secrets*`,
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:staging-rendasua-backend-secrets*`,
        ],
      })
    );

    // Create EventBridge rule to trigger the function every 45 minutes
    new events.Rule(this, `RefreshMobilePaymentsKeyRule-${environment}`, {
      ruleName: `refresh-mobile-payments-key-rule-${environment}`,
      description: 'Triggers mobile payments key refresh every 45 minutes',
      schedule: events.Schedule.rate(cdk.Duration.minutes(45)),
      targets: [new targets.LambdaFunction(refreshMobilePaymentsKeyFunction)],
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
  }
}
