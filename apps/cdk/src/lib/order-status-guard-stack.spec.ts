import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { OrderStatusGuardStack } from './order-status-guard-stack';

describe('OrderStatusGuardStack', () => {
  function synthStack(environment: string): Template {
    const app = new cdk.App();
    const stack = new OrderStatusGuardStack(app, `Guard-${environment}`, {
      environment,
      env: { account: '235680477887', region: 'ca-central-1' },
    });
    return Template.fromStack(stack);
  }

  it('creates an SNS topic with email subscription to tech@rendasua.com', () => {
    const template = synthStack('development');

    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'order-status-guard-development',
      DisplayName: 'Order Status Guards (development)',
    });
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'tech@rendasua.com',
    });
  });

  it('lets EventBridge publish to the SNS topic', () => {
    const template = synthStack('development');

    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'AllowEventBridgePublish',
            Effect: 'Allow',
            Action: 'sns:Publish',
            Principal: { Service: 'events.amazonaws.com' },
          }),
        ]),
      },
    });
  });

  it('matches CloudTrail UpdateEventSourceMapping when enabled is false', () => {
    const template = synthStack('development');

    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'order-status-mapping-disabled-development',
      EventPattern: {
        source: ['aws.lambda'],
        'detail-type': ['AWS API Call via CloudTrail'],
        detail: {
          eventName: [{ prefix: 'UpdateEventSourceMapping' }],
          requestParameters: { enabled: [false] },
        },
      },
    });
  });

  it('matches CloudTrail DeleteEventSourceMapping', () => {
    const template = synthStack('production');

    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'order-status-mapping-deleted-production',
      EventPattern: {
        source: ['aws.lambda'],
        'detail-type': ['AWS API Call via CloudTrail'],
        detail: {
          eventName: [{ prefix: 'DeleteEventSourceMapping' }],
        },
      },
    });
  });

  it('transforms mapping-change events with the required CloudTrail fields', () => {
    const template = synthStack('development');
    const rules = template.findResources('AWS::Events::Rule');
    const disableRule = Object.values(rules).find(
      (rule) =>
        rule.Properties?.Name === 'order-status-mapping-disabled-development'
    );
    const transformer =
      disableRule?.Properties?.Targets?.[0]?.InputTransformer;

    expect(transformer.InputPathsMap).toEqual(
      expect.objectContaining({
        'detail-eventName': '$.detail.eventName',
        'detail-userIdentity-arn': '$.detail.userIdentity.arn',
        'detail-sourceIPAddress': '$.detail.sourceIPAddress',
        'detail-userAgent': '$.detail.userAgent',
        'detail-requestParameters-uUID': '$.detail.requestParameters.uUID',
        'detail-eventTime': '$.detail.eventTime',
      })
    );
  });

  it('alarms production oldest-message age at 300s over 3 one-minute periods', () => {
    const template = synthStack('production');

    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'order-status-oldest-message-age-production',
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateAgeOfOldestMessage',
      Statistic: 'Maximum',
      Threshold: 300,
      Period: 60,
      EvaluationPeriods: 3,
      ComparisonOperator: 'GreaterThanThreshold',
      TreatMissingData: 'notBreaching',
      Dimensions: [
        {
          Name: 'QueueName',
          Value: 'order-status-changes-production.fifo',
        },
      ],
    });
  });

  it('alarms development oldest-message age at 900s over 3 five-minute periods', () => {
    const template = synthStack('development');

    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'order-status-oldest-message-age-development',
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateAgeOfOldestMessage',
      Statistic: 'Maximum',
      Threshold: 900,
      Period: 300,
      EvaluationPeriods: 3,
      TreatMissingData: 'notBreaching',
      Dimensions: [
        {
          Name: 'QueueName',
          Value: 'order-status-changes-development.fifo',
        },
      ],
    });
  });

  it('alarms visible messages over 50 for 10 minutes in both environments', () => {
    for (const environment of ['development', 'production']) {
      const template = synthStack(environment);
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `order-status-messages-visible-${environment}`,
        Namespace: 'AWS/SQS',
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Statistic: 'Maximum',
        Threshold: 50,
        Period: 60,
        EvaluationPeriods: 10,
        TreatMissingData: 'notBreaching',
        Dimensions: [
          {
            Name: 'QueueName',
            Value: `order-status-changes-${environment}.fifo`,
          },
        ],
      });
    }
  });

  it('does not create an IAM deny policy', () => {
    const template = synthStack('development');
    const policies = template.findResources('AWS::IAM::Policy');
    const managed = template.findResources('AWS::IAM::ManagedPolicy');
    expect(policies).toEqual({});
    expect(managed).toEqual({});
  });
});
