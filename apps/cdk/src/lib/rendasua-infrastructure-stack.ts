import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
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
