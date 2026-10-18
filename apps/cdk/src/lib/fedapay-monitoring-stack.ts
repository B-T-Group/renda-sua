import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface FedapayMonitoringStackProps extends cdk.StackProps {
  /**
   * Environment name (e.g., 'dev', 'production')
   */
  environment: string;

  /**
   * CloudWatch Log Group name for the backend
   * (e.g., 'rendasua-backend-dev' or 'rendasua-backend-prod')
   */
  logGroupName: string;
}

export class FedapayMonitoringStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: FedapayMonitoringStackProps
  ) {
    super(scope, id, props);

    const { environment, logGroupName } = props;

    // Create SNS topic for FedaPay monitoring alerts
    const alarmTopic = new sns.Topic(
      this,
      `FedapayMonitoringTopic-${environment}`,
      {
        topicName: `fedapay-monitoring-${environment}`,
        displayName: `FedaPay Monitoring Alerts (${environment})`,
      }
    );

    // Add email subscription to tech@rendasua.com
    // Note: Requires one-time confirmation click in the inbox after first deploy
    alarmTopic.addSubscription(
      new subscriptions.EmailSubscription('tech@rendasua.com')
    );

    // Reference the existing log group
    const logGroup = logs.LogGroup.fromLogGroupName(
      this,
      `BackendLogGroup-${environment}`,
      logGroupName
    );

    // Create metric filter for fedapay_live_record_incomplete log marker
    // Use per-environment metric name to avoid AWS dimension + defaultValue conflict
    const metricNamespace = 'Rendasua/Backend';
    const metricName = `FedapayLiveRecordIncomplete-${environment}`;

    const metricFilter = new logs.MetricFilter(
      this,
      `FedapayLiveRecordIncompleteFilter-${environment}`,
      {
        logGroup,
        metricNamespace,
        metricName,
        // JSON filter pattern: match message field that starts with the marker
        // Prevents counting "fedapay_live_record_incomplete_repeated" or similar variants
        filterPattern: logs.FilterPattern.literal('{ $.message = "fedapay_live_record_incomplete tx=*" }'),
        metricValue: '1',
        defaultValue: 0,
        // No dimensions - AWS rejects dimensions with defaultValue 0
      }
    );

    // Create CloudWatch alarm
    const metric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName,
      // No dimensions - using per-environment metric name instead
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.hours(1),
    });

    const alarm = new cloudwatch.Alarm(
      this,
      `FedapayLiveRecordIncompleteAlarm-${environment}`,
      {
        alarmName: `fedapay-live-record-incomplete-${environment}`,
        alarmDescription: `Alert when fedapay_live_record_incomplete marker appears >= 2 times in 1 hour (${environment} environment)`,
        metric,
        threshold: 2,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // Add alarm actions (ALARM and OK states)
    const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);
    alarm.addAlarmAction(snsAction);
    alarm.addOkAction(snsAction);

    // Outputs
    new cdk.CfnOutput(this, `SnsTopicArn-${environment}`, {
      value: alarmTopic.topicArn,
      description: `SNS topic ARN for FedaPay monitoring alerts in ${environment}`,
    });
  }
}
