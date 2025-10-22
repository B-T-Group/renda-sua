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

    // Create the Airtel mobile payments key refresh Lambda function
    const refreshAirtelMobilePaymentsKeyFunction = new lambda.Function(
      this,
      `RefreshAirtelMobilePaymentsKey-${environment}`,
      {
        functionName: `refresh-airtel-mobile-payments-key-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'refresh-airtel-mobile-payments-key.handler',
        code: lambda.Code.fromAsset('src/lambda'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        layers: [requestsLayer],
        environment: {
          ENVIRONMENT: environment,
          AIRTEL_OPERATION_ACCOUNT_CODE:
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

    // Create the MOOV mobile payments key refresh Lambda function (only in production)
    let refreshMoovMobilePaymentsKeyFunction: lambda.Function | undefined;
    if (environment === 'production') {
      refreshMoovMobilePaymentsKeyFunction = new lambda.Function(
        this,
        `RefreshMoovMobilePaymentsKey-${environment}`,
        {
          functionName: `refresh-moov-mobile-payments-key-${environment}`,
          runtime: lambda.Runtime.PYTHON_3_9,
          handler: 'refresh-moov-mobile-payments-key.handler',
          code: lambda.Code.fromAsset('src/lambda'),
          timeout: cdk.Duration.minutes(5),
          memorySize: 256,
          layers: [requestsLayer],
          environment: {
            ENVIRONMENT: environment,
            MOOV_OPERATION_ACCOUNT_CODE: 'ACC_68F90896204C1',
            RECEPTION_URL_CODE: 'BQ1TV',
            MYPVIT_SECRET_KEY_REFRESH_PATH: 'CJF0DPOVZU87UUK8',
          },
        }
      );
    }

    // Add permissions for Secrets Manager to both functions
    const secretsManagerPolicy = new iam.PolicyStatement({
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
    });

    refreshAirtelMobilePaymentsKeyFunction.addToRolePolicy(
      secretsManagerPolicy
    );

    // Add permissions to MOOV function only if it exists (production only)
    if (refreshMoovMobilePaymentsKeyFunction) {
      refreshMoovMobilePaymentsKeyFunction.addToRolePolicy(
        secretsManagerPolicy
      );
    }

    // Create EventBridge rule for Airtel function (every 45 minutes)
    new events.Rule(this, `RefreshAirtelMobilePaymentsKeyRule-${environment}`, {
      ruleName: `refresh-airtel-mobile-payments-key-rule-${environment}`,
      description:
        'Triggers Airtel mobile payments key refresh every 45 minutes',
      schedule: events.Schedule.rate(cdk.Duration.minutes(45)),
      targets: [
        new targets.LambdaFunction(refreshAirtelMobilePaymentsKeyFunction),
      ],
    });

    // Create EventBridge rule for MOOV function (every 45 minutes) - only in production
    if (refreshMoovMobilePaymentsKeyFunction) {
      new events.Rule(this, `RefreshMoovMobilePaymentsKeyRule-${environment}`, {
        ruleName: `refresh-moov-mobile-payments-key-rule-${environment}`,
        description:
          'Triggers MOOV mobile payments key refresh every 45 minutes',
        schedule: events.Schedule.rate(cdk.Duration.minutes(45)),
        targets: [
          new targets.LambdaFunction(refreshMoovMobilePaymentsKeyFunction),
        ],
      });
    }

    // Output Airtel function details
    new cdk.CfnOutput(
      this,
      `RefreshAirtelMobilePaymentsKeyFunctionArn-${environment}`,
      {
        value: refreshAirtelMobilePaymentsKeyFunction.functionArn,
        description:
          'ARN of the Airtel mobile payments key refresh Lambda function',
        exportName: `RefreshAirtelMobilePaymentsKeyFunctionArn-${environment}`,
      }
    );

    new cdk.CfnOutput(
      this,
      `RefreshAirtelMobilePaymentsKeyFunctionName-${environment}`,
      {
        value: refreshAirtelMobilePaymentsKeyFunction.functionName,
        description:
          'Name of the Airtel mobile payments key refresh Lambda function',
        exportName: `RefreshAirtelMobilePaymentsKeyFunctionName-${environment}`,
      }
    );

    // Output MOOV function details (only in production)
    if (refreshMoovMobilePaymentsKeyFunction) {
      new cdk.CfnOutput(
        this,
        `RefreshMoovMobilePaymentsKeyFunctionArn-${environment}`,
        {
          value: refreshMoovMobilePaymentsKeyFunction.functionArn,
          description:
            'ARN of the MOOV mobile payments key refresh Lambda function',
          exportName: `RefreshMoovMobilePaymentsKeyFunctionArn-${environment}`,
        }
      );

      new cdk.CfnOutput(
        this,
        `RefreshMoovMobilePaymentsKeyFunctionName-${environment}`,
        {
          value: refreshMoovMobilePaymentsKeyFunction.functionName,
          description:
            'Name of the MOOV mobile payments key refresh Lambda function',
          exportName: `RefreshMoovMobilePaymentsKeyFunctionName-${environment}`,
        }
      );
    }
  }
}
