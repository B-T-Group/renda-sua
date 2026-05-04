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

    // Core shared layer for models, handlers, Hasura client, and deps
    const corePackagesLayer = new lambda.LayerVersion(
      this,
      `CorePackagesLayer-${environment}`,
      {
        layerVersionName: `core-packages-layer-${environment}`,
        description:
          'Core Python packages (models, commission/notification handlers, secrets manager, hasura_client, requests, pydantic)',
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

    const backendInternalApiBaseUrl =
      environment === 'production'
        ? 'https://api.rendasua.com'
        : 'https://dev.api.rendasua.com';

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
        layers: [requestsLayer, corePackagesLayer],
        environment: {
          ENVIRONMENT: environment,
          GRAPHQL_ENDPOINT: graphqlEndpoint,
          SLACK_ORDER_WEBHOOK_URL: process.env.SLACK_ORDER_WEBHOOK_URL ?? '',
          PUBLIC_WEB_APP_URL:
            process.env.PUBLIC_WEB_APP_URL ??
            (environment === 'production'
              ? 'https://rendasua.com'
              : 'https://dev.rendasua.com'),
          SLACK_ORDER_ALERTS_IN_DEVELOPMENT:
            process.env.SLACK_ORDER_ALERTS_IN_DEVELOPMENT ?? 'false',
          PROXIMITY_RADIUS_KM: '20',
          RESEND_AGENT_ORDER_PROXIMITY_TEMPLATE_ID:
            'dc4461e3-4cd2-485b-8c9c-755e36205f30',
          RESEND_AGENT_ORDER_PROXIMITY_TEMPLATE_ID_FR:
            '724f37bc-4730-4452-ba12-63142b9f45d9',
          RESEND_AGENT_ORDERS_NEARBY_SUMMARY_TEMPLATE_ID:
            'ef9aa9fa-abab-4e11-9ee0-a7ff4e7a5a2c',
          RESEND_AGENT_ORDERS_NEARBY_SUMMARY_TEMPLATE_ID_FR:
            '2980279e-9026-442d-9539-031a842c2657',
          RESEND_CLIENT_ORDER_CANCELLED_TEMPLATE_ID:
            '56396cb4-1208-4dbd-a814-f128d1bfa980',
          RESEND_CLIENT_ORDER_CANCELLED_TEMPLATE_ID_FR:
            '0ac655d8-4690-438a-83cc-d824f5c6f4cd',
          RESEND_BUSINESS_ORDER_CANCELLED_TEMPLATE_ID:
            'ba0d8af6-fc9c-439b-b0cd-7bbf061ec23f',
          RESEND_BUSINESS_ORDER_CANCELLED_TEMPLATE_ID_FR:
            '56f4b6ae-c034-4a2b-a0c8-761b05e81c0f',
          RESEND_AGENT_ORDER_CANCELLED_TEMPLATE_ID:
            'f7d21404-c231-4d48-8253-a4a98bbc222a',
          RESEND_AGENT_ORDER_CANCELLED_TEMPLATE_ID_FR:
            '61a58586-3e09-4867-8417-7c6b9647fd09',
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
        layers: [requestsLayer, corePackagesLayer],
        environment: {
          ENVIRONMENT: environment,
          GRAPHQL_ENDPOINT: graphqlEndpoint,
          BACKEND_INTERNAL_API_BASE_URL: backendInternalApiBaseUrl,
          NOTIFICATIONS_INTERNAL_API_KEY: '',
          PROXIMITY_RADIUS_KM: '20',
          RESEND_AGENT_ORDER_PROXIMITY_TEMPLATE_ID:
            'dc4461e3-4cd2-485b-8c9c-755e36205f30',
          RESEND_AGENT_ORDER_PROXIMITY_TEMPLATE_ID_FR:
            '724f37bc-4730-4452-ba12-63142b9f45d9',
          RESEND_AGENT_ORDERS_NEARBY_SUMMARY_TEMPLATE_ID:
            'ef9aa9fa-abab-4e11-9ee0-a7ff4e7a5a2c',
          RESEND_AGENT_ORDERS_NEARBY_SUMMARY_TEMPLATE_ID_FR:
            '2980279e-9026-442d-9539-031a842c2657',
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
          runtime: lambda.Runtime.PYTHON_3_11,
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
