import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
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
        compatibleRuntimes: [
          lambda.Runtime.PYTHON_3_9,
          lambda.Runtime.PYTHON_3_11,
        ],
      }
    );

    // Create Lambda layer for SendGrid dependency
    const sendgridLayer = new lambda.LayerVersion(
      this,
      `SendGridLayer-${environment}`,
      {
        layerVersionName: `sendgrid-layer-${environment}`,
        description: 'Lambda layer containing SendGrid library',
        code: lambda.Code.fromAsset('src/lambda-layer/sendgrid-layer.zip'),
        compatibleRuntimes: [
          lambda.Runtime.PYTHON_3_9,
          lambda.Runtime.PYTHON_3_11,
        ],
      }
    );

    // Core shared layer for models, handlers, Hasura client, and deps
    const corePackagesLayer = new lambda.LayerVersion(
      this,
      `CorePackagesLayer-${environment}`,
      {
        layerVersionName: `core-packages-layer-${environment}`,
        description:
          'Core Python packages (models, commission/notification handlers, secrets manager, hasura_client, requests, sendgrid, pydantic)',
        code: lambda.Code.fromAsset('src/lambda-layer/core-packages-layer.zip'),
        compatibleRuntimes: [
          lambda.Runtime.PYTHON_3_9,
          lambda.Runtime.PYTHON_3_11,
        ],
      }
    );

    // Add permissions for Secrets Manager (used by multiple Lambda functions)
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

    // Create FIFO SQS queue for order status changes
    const orderStatusQueue = new sqs.Queue(
      this,
      `OrderStatusChangesQueue-${environment}`,
      {
        queueName: `order-status-changes-${environment}.fifo`,
        fifo: true,
        contentBasedDeduplication: true,
        retentionPeriod: cdk.Duration.days(14),
        visibilityTimeout: cdk.Duration.minutes(5),
      }
    );

    // GraphQL endpoint based on environment
    const graphqlEndpoint =
      environment === 'production'
        ? 'https://rendasua-prod.hasura.app/v1/graphql'
        : 'https://healthy-mackerel-72.hasura.app/v1/graphql';

    // Create Lambda function for order status handler
    const orderStatusHandlerFunction = new lambda.Function(
      this,
      `OrderStatusHandler-${environment}`,
      {
        functionName: `order-status-handler-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset('src/lambda/order-status-handler'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        layers: [requestsLayer, sendgridLayer, corePackagesLayer],
        environment: {
          ENVIRONMENT: environment,
          GRAPHQL_ENDPOINT: graphqlEndpoint,
          PROXIMITY_RADIUS_KM: '20',
          SENDGRID_ORDER_PROXIMITY_TEMPLATE_ID:
            'd-3c3d59c19cfa4da2b8d1e072f416a06a', // French version
        },
      }
    );

    // Add Secrets Manager permissions
    orderStatusHandlerFunction.addToRolePolicy(secretsManagerPolicy);

    // Add SQS permissions
    orderStatusHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [orderStatusQueue.queueArn],
      })
    );

    // Connect Lambda to SQS as event source
    // Note: FIFO queues don't support maxBatchingWindow
    orderStatusHandlerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(orderStatusQueue, {
        batchSize: 10,
      })
    );

    // Output queue URL
    new cdk.CfnOutput(this, `OrderStatusQueueUrl-${environment}`, {
      value: orderStatusQueue.queueUrl,
      description: 'SQS Queue URL for order status changes',
      exportName: `OrderStatusQueueUrl-${environment}`,
    });

    // Output Lambda function ARN
    new cdk.CfnOutput(this, `OrderStatusHandlerFunctionArn-${environment}`, {
      value: orderStatusHandlerFunction.functionArn,
      description: 'ARN of the order status handler Lambda function',
      exportName: `OrderStatusHandlerFunctionArn-${environment}`,
    });

    // Wait-handler Lambda (generic: payment timeout, etc.)
    const waitHandlerFunction = new lambda.Function(
      this,
      `WaitHandler-${environment}`,
      {
        functionName: `wait-handler-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset('src/lambda/wait-handler'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        layers: [requestsLayer, corePackagesLayer],
        environment: {
          ENVIRONMENT: environment,
          GRAPHQL_ENDPOINT: graphqlEndpoint,
          ORDER_STATUS_QUEUE_URL: orderStatusQueue.queueUrl,
        },
      }
    );
    waitHandlerFunction.addToRolePolicy(secretsManagerPolicy);
    waitHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: [orderStatusQueue.queueArn],
      })
    );

    // Generic wait-and-execute state machine: Wait until run_at -> Invoke wait-handler
    const waitState = new sfn.Wait(this, `WaitUntilRunAt-${environment}`, {
      time: sfn.WaitTime.timestampPath('$.run_at'),
    });
    const invokeWaitHandler = new tasks.LambdaInvoke(
      this,
      `InvokeWaitHandler-${environment}`,
      {
        lambdaFunction: waitHandlerFunction,
        payload: sfn.TaskInput.fromObject({
          'event_type.$': '$.event_type',
          'payload.$': '$.payload',
          'run_at.$': '$.run_at',
        }),
      }
    );
    const definition = waitState.next(invokeWaitHandler);
    const waitExecuteStateMachine = new sfn.StateMachine(
      this,
      `WaitExecuteStateMachine-${environment}`,
      {
        stateMachineName: `wait-execute-${environment}`,
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
      }
    );

    new cdk.CfnOutput(this, `WaitExecuteStateMachineArn-${environment}`, {
      value: waitExecuteStateMachine.stateMachineArn,
      description: 'ARN of the wait-and-execute Step Functions state machine',
      exportName: `WaitExecuteStateMachineArn-${environment}`,
    });

    // Create Lambda function for notify-agents (scheduled)
    const notifyAgentsFunction = new lambda.Function(
      this,
      `NotifyAgents-${environment}`,
      {
        functionName: `notify-agents-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset('src/lambda/notify-agents'),
        timeout: cdk.Duration.minutes(15),
        memorySize: 512,
        layers: [requestsLayer, sendgridLayer, corePackagesLayer],
        environment: {
          ENVIRONMENT: environment,
          GRAPHQL_ENDPOINT: graphqlEndpoint,
          PROXIMITY_RADIUS_KM: '20',
          SENDGRID_ORDER_PROXIMITY_TEMPLATE_ID:
            'd-3c3d59c19cfa4da2b8d1e072f416a06a', // French version
        },
      }
    );

    // Add Secrets Manager permissions
    notifyAgentsFunction.addToRolePolicy(secretsManagerPolicy);

    // Create EventBridge rule to trigger Lambda every hour at the top of the hour (00:00)
    new events.Rule(this, `NotifyAgentsRule-${environment}`, {
      ruleName: `notify-agents-rule-${environment}`,
      description: 'Triggers agent notification processing every hour at 00:00',
      schedule: events.Schedule.cron({ minute: '0' }),
      targets: [new targets.LambdaFunction(notifyAgentsFunction)],
    });

    // Output notify-agents function details
    new cdk.CfnOutput(this, `NotifyAgentsFunctionArn-${environment}`, {
      value: notifyAgentsFunction.functionArn,
      description: 'ARN of the notify-agents Lambda function',
      exportName: `NotifyAgentsFunctionArn-${environment}`,
    });

    new cdk.CfnOutput(this, `NotifyAgentsFunctionName-${environment}`, {
      value: notifyAgentsFunction.functionName,
      description: 'Name of the notify-agents Lambda function',
      exportName: `NotifyAgentsFunctionName-${environment}`,
    });

    // Create the Airtel mobile payments key refresh Lambda function
    const refreshAirtelMobilePaymentsKeyFunction = new lambda.Function(
      this,
      `RefreshAirtelMobilePaymentsKey-${environment}`,
      {
        functionName: `refresh-airtel-mobile-payments-key-${environment}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'refresh-airtel-mobile-payments-key.handler',
        code: lambda.Code.fromAsset('src/lambda'),
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        layers: [requestsLayer, corePackagesLayer],
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
          layers: [requestsLayer, corePackagesLayer],
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
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
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
        schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
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
