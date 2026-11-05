import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface OrderStatusGuardStackProps extends cdk.StackProps {
  environment: string;
}

/**
 * Alerts when the order-status SQS→Lambda mapping is disabled/deleted
 * or when the FIFO queue starts backing up.
 */
export class OrderStatusGuardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OrderStatusGuardStackProps) {
    super(scope, id, props);
    const { environment } = props;
    const topic = this.createAlarmTopic(environment);
    this.allowEventBridgePublish(topic);
    this.addDisableMappingRule(environment, topic);
    this.addDeleteMappingRule(environment, topic);
    this.addQueueAlarms(environment, topic);
    new cdk.CfnOutput(this, `SnsTopicArn-${environment}`, {
      value: topic.topicArn,
      description: `SNS topic ARN for order-status guards in ${environment}`,
    });
  }

  private createAlarmTopic(environment: string): sns.Topic {
    const topic = new sns.Topic(this, `OrderStatusGuardTopic-${environment}`, {
      topicName: `order-status-guard-${environment}`,
      displayName: `Order Status Guards (${environment})`,
    });
    // Requires one-time confirmation click in the inbox after first deploy
    topic.addSubscription(
      new subscriptions.EmailSubscription('tech@rendasua.com')
    );
    return topic;
  }

  private allowEventBridgePublish(topic: sns.Topic): void {
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowEventBridgePublish',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('events.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      })
    );
  }

  private mappingChangeTarget(topic: sns.Topic): targets.SnsTopic {
    return new targets.SnsTopic(topic, {
      message: events.RuleTargetInput.fromObject({
        eventName: events.EventField.fromPath('$.detail.eventName'),
        userIdentityArn: events.EventField.fromPath('$.detail.userIdentity.arn'),
        sourceIPAddress: events.EventField.fromPath(
          '$.detail.sourceIPAddress'
        ),
        userAgent: events.EventField.fromPath('$.detail.userAgent'),
        uuid: events.EventField.fromPath('$.detail.requestParameters.uUID'),
        eventTime: events.EventField.fromPath('$.detail.eventTime'),
      }),
    });
  }

  private addDisableMappingRule(environment: string, topic: sns.Topic): void {
    new events.Rule(this, `OrderStatusMappingDisabled-${environment}`, {
      ruleName: `order-status-mapping-disabled-${environment}`,
      description:
        'Alert when a Lambda event source mapping is disabled via CloudTrail',
      eventPattern: {
        source: ['aws.lambda'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: events.Match.prefix('UpdateEventSourceMapping'),
          requestParameters: { enabled: [false] },
        },
      },
      targets: [this.mappingChangeTarget(topic)],
    });
  }

  private addDeleteMappingRule(environment: string, topic: sns.Topic): void {
    new events.Rule(this, `OrderStatusMappingDeleted-${environment}`, {
      ruleName: `order-status-mapping-deleted-${environment}`,
      description:
        'Alert when a Lambda event source mapping is deleted via CloudTrail',
      eventPattern: {
        source: ['aws.lambda'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: events.Match.prefix('DeleteEventSourceMapping'),
        },
      },
      targets: [this.mappingChangeTarget(topic)],
    });
  }

  private addQueueAlarms(environment: string, topic: sns.Topic): void {
    const queueName = `order-status-changes-${environment}.fifo`;
    const queue = sqs.Queue.fromQueueAttributes(
      this,
      `OrderStatusQueue-${environment}`,
      {
        queueName,
        queueArn: `arn:aws:sqs:${this.region}:${this.account}:${queueName}`,
        fifo: true,
      }
    );
    const snsAction = new cloudwatch_actions.SnsAction(topic);
    this.addOldestMessageAlarm(environment, queue, snsAction);
    this.addVisibleMessagesAlarm(environment, queue, snsAction);
  }

  private oldestMessagePeriod(environment: string): cdk.Duration {
    return environment === 'production'
      ? cdk.Duration.minutes(1)
      : cdk.Duration.minutes(5);
  }

  private oldestMessageThreshold(environment: string): number {
    return environment === 'production' ? 300 : 900;
  }

  private addOldestMessageAlarm(
    environment: string,
    queue: sqs.IQueue,
    snsAction: cloudwatch_actions.SnsAction
  ): void {
    const alarm = queue
      .metricApproximateAgeOfOldestMessage({
        statistic: cloudwatch.Stats.MAXIMUM,
        period: this.oldestMessagePeriod(environment),
      })
      .createAlarm(this, `OrderStatusOldestMessageAge-${environment}`, {
        alarmName: `order-status-oldest-message-age-${environment}`,
        alarmDescription: `Oldest message on order-status-changes-${environment}.fifo is too old`,
        threshold: this.oldestMessageThreshold(environment),
        evaluationPeriods: 3,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    this.bindAlarmActions(alarm, snsAction);
  }

  private addVisibleMessagesAlarm(
    environment: string,
    queue: sqs.IQueue,
    snsAction: cloudwatch_actions.SnsAction
  ): void {
    const alarm = queue
      .metricApproximateNumberOfMessagesVisible({
        statistic: cloudwatch.Stats.MAXIMUM,
        period: cdk.Duration.minutes(1),
      })
      .createAlarm(this, `OrderStatusMessagesVisible-${environment}`, {
        alarmName: `order-status-messages-visible-${environment}`,
        alarmDescription: `Visible messages on order-status-changes-${environment}.fifo exceeded 50`,
        threshold: 50,
        evaluationPeriods: 10,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    this.bindAlarmActions(alarm, snsAction);
  }

  private bindAlarmActions(
    alarm: cloudwatch.Alarm,
    snsAction: cloudwatch_actions.SnsAction
  ): void {
    alarm.addAlarmAction(snsAction);
    alarm.addOkAction(snsAction);
  }
}
