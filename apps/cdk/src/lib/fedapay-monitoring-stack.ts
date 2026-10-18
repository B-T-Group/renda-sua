import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
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

  /**
   * ARN of the SNS topic to send alarm notifications to.
   * If not provided, alarms will be created without actions.
   * You must create and configure the SNS topic separately.
   */
  alarmTopicArn?: string;
}

export class FedapayMonitoringStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: FedapayMonitoringStackProps
  ) {
    super(scope, id, props);

    const { environment, logGroupName, alarmTopicArn } = props;

    // Reference the existing log group
    const logGroup = logs.LogGroup.fromLogGroupName(
      this,
      `BackendLogGroup-${environment}`,
      logGroupName
    );

    // Create metric filter for fedapay_live_record_incomplete log marker
    const metricNamespace = 'Rendasua/Backend';
    const metricName = 'FedapayLiveRecordIncomplete';

    const metricFilter = new logs.MetricFilter(
      this,
      `FedapayLiveRecordIncompleteFilter-${environment}`,
      {
        logGroup,
        metricNamespace,
        metricName,
        filterPattern: logs.FilterPattern.literal('fedapay_live_record_incomplete'),
        metricValue: '1',
        defaultValue: 0,
        dimensions: {
          Environment: environment,
        },
      }
    );

    // Create CloudWatch alarm
    const metric = new cloudwatch.Metric({
      namespace: metricNamespace,
      metricName,
      dimensionsMap: {
        Environment: environment,
      },
      statistic: cloudwatch.Stats.SUM,
      period: cdk.Duration.minutes(15),
    });

    const alarm = new cloudwatch.Alarm(
      this,
      `FedapayLiveRecordIncompleteAlarm-${environment}`,
      {
        alarmName: `fedapay-live-record-incomplete-${environment}`,
        alarmDescription: `Alert when fedapay_live_record_incomplete marker appears >= 3 times in 15 minutes (${environment} environment)`,
        metric,
        threshold: 3,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // Add SNS action if topic ARN is provided
    if (alarmTopicArn) {
      const alarmTopic = sns.Topic.fromTopicArn(
        this,
        `AlarmTopic-${environment}`,
        alarmTopicArn
      );
      alarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
    }

    // Outputs
    new cdk.CfnOutput(this, `MetricFilterName-${environment}`, {
      value: metricFilter.node.id,
      description: `Metric filter name for fedapay_live_record_incomplete in ${environment}`,
      exportName: `FedapayLiveRecordIncompleteFilterName-${environment}`,
    });

    new cdk.CfnOutput(this, `AlarmName-${environment}`, {
      value: alarm.alarmName,
      description: `Alarm name for fedapay_live_record_incomplete in ${environment}`,
      exportName: `FedapayLiveRecordIncompleteAlarmName-${environment}`,
    });

    new cdk.CfnOutput(this, `MetricNamespace-${environment}`, {
      value: metricNamespace,
      description: 'CloudWatch metric namespace',
    });

    new cdk.CfnOutput(this, `MetricName-${environment}`, {
      value: metricName,
      description: 'CloudWatch metric name',
    });
  }
}
