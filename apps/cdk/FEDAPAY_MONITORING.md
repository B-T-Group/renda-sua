# FedaPay Live Record Monitoring

This CDK infrastructure monitors the backend logs for the `fedapay_live_record_incomplete` marker, which is emitted when FedaPay mobile money transaction records are incomplete and require attention before going live in Togo.

## Overview

The monitoring infrastructure consists of:

1. **CloudWatch Metric Filters**: Parse backend logs for the literal marker `fedapay_live_record_incomplete` and publish to a custom CloudWatch metric
2. **CloudWatch Alarms**: Alert when the marker appears 3 or more times within a 15-minute period
3. **Per-environment setup**: Separate monitoring for dev and production environments

## Architecture

### Metric Details

- **Namespace**: `Rendasua/Backend`
- **Metric Name**: `FedapayLiveRecordIncomplete`
- **Dimension**: `Environment` (either `dev` or `production`)
- **Unit**: Count (each log occurrence increments by 1)

### Alarm Configuration

- **Threshold**: Sum >= 3 over a single 15-minute evaluation period
- **Missing Data Treatment**: `NOT_BREACHING` (missing data doesn't trigger the alarm)
- **Alarm Names**:
  - Dev: `fedapay-live-record-incomplete-dev`
  - Production: `fedapay-live-record-incomplete-production`

### Log Groups

The metric filters monitor these CloudWatch Log Groups:

- **Dev**: `rendasua-backend-dev`
- **Production**: `rendasua-backend-prod`

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. CDK CLI installed (`npm install -g aws-cdk`)
3. CDK bootstrapped in `ca-central-1` region
4. (Optional) SNS topics created for alarm notifications

### Deploy Both Stacks

To deploy both dev and production monitoring:

```bash
cd apps/cdk

# Without SNS notification
npx cdk deploy FedapayMonitoring-dev FedapayMonitoring-production

# With SNS notification (recommended)
npx cdk deploy FedapayMonitoring-dev FedapayMonitoring-production \
  --context fedapayDevAlarmTopicArn=arn:aws:sns:ca-central-1:235680477887:backend-alerts-dev \
  --context fedapayProdAlarmTopicArn=arn:aws:sns:ca-central-1:235680477887:backend-alerts-prod
```

### Deploy Individual Stack

To deploy only one environment:

```bash
# Dev only
npx cdk deploy FedapayMonitoring-dev

# Production only
npx cdk deploy FedapayMonitoring-production
```

### SNS Topic Configuration

The alarms can optionally send notifications to an SNS topic. You must:

1. **Create the SNS topic** (if it doesn't exist):

```bash
# Example: Create dev alert topic
aws sns create-topic \
  --name backend-alerts-dev \
  --region ca-central-1

# Example: Create production alert topic
aws sns create-topic \
  --name backend-alerts-prod \
  --region ca-central-1
```

2. **Subscribe to the topic** (email, SMS, Slack, etc.):

```bash
# Example: Subscribe email to dev alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:235680477887:backend-alerts-dev \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ca-central-1

# Confirm the subscription by clicking the link in the email
```

3. **Deploy with the topic ARN**:

```bash
npx cdk deploy FedapayMonitoring-dev \
  --context fedapayDevAlarmTopicArn=arn:aws:sns:ca-central-1:235680477887:backend-alerts-dev
```

If you don't provide an SNS topic ARN, the alarm will be created **without notification actions** and will only be visible in the CloudWatch console.

## Verification

After deployment, verify the resources were created:

### Check Metric Filters

```bash
# Dev
aws logs describe-metric-filters \
  --log-group-name rendasua-backend-dev \
  --region ca-central-1

# Production
aws logs describe-metric-filters \
  --log-group-name rendasua-backend-prod \
  --region ca-central-1
```

### Check Alarms

```bash
# List all alarms
aws cloudwatch describe-alarms \
  --alarm-names fedapay-live-record-incomplete-dev fedapay-live-record-incomplete-production \
  --region ca-central-1
```

### Test the Metric Filter

To test that the metric filter is working, emit a test log with the marker:

```bash
# Note: This requires the backend to be running and logging to CloudWatch
# The marker should appear in the backend logs when there's an incomplete FedaPay record
```

You can verify the metric is being published:

```bash
aws cloudwatch get-metric-statistics \
  --namespace Rendasua/Backend \
  --metric-name FedapayLiveRecordIncomplete \
  --dimensions Name=Environment,Value=dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 900 \
  --statistics Sum \
  --region ca-central-1
```

## Monitoring

### CloudWatch Console

View the alarms in the CloudWatch console:

1. Go to: https://console.aws.amazon.com/cloudwatch/
2. Region: ca-central-1
3. Navigate to **Alarms** → **All alarms**
4. Search for: `fedapay-live-record-incomplete`

### Alarm States

- **OK**: No incomplete records detected (< 3 in 15 minutes)
- **ALARM**: 3 or more incomplete records detected in a 15-minute window
- **INSUFFICIENT_DATA**: Alarm just created or no data points yet

## Troubleshooting

### Alarm not triggering

1. Verify the log group exists and is receiving logs:
   ```bash
   aws logs describe-log-groups \
     --log-group-name-prefix rendasua-backend \
     --region ca-central-1
   ```

2. Check if the marker appears in logs:
   ```bash
   aws logs filter-log-events \
     --log-group-name rendasua-backend-dev \
     --filter-pattern "fedapay_live_record_incomplete" \
     --region ca-central-1
   ```

3. Verify the metric filter is active:
   ```bash
   aws logs describe-metric-filters \
     --log-group-name rendasua-backend-dev \
     --region ca-central-1
   ```

### SNS notifications not received

1. Check SNS topic subscriptions are confirmed:
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:ca-central-1:235680477887:backend-alerts-dev \
     --region ca-central-1
   ```

2. Verify the alarm has the SNS action:
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names fedapay-live-record-incomplete-dev \
     --region ca-central-1
   ```

## Cleanup

To remove the monitoring infrastructure:

```bash
cd apps/cdk

# Delete both stacks
npx cdk destroy FedapayMonitoring-dev FedapayMonitoring-production

# Or delete individually
npx cdk destroy FedapayMonitoring-dev
npx cdk destroy FedapayMonitoring-production
```

## Related

- **Log marker PR**: renda-sua#587 (backend code that emits the marker)
- **Context**: This monitoring is a precondition for FedaPay going live in Togo
- **Region**: ca-central-1 (all Rendasua infrastructure)

## Stack Outputs

After deployment, the stack exports these values:

- `FedapayLiveRecordIncompleteFilterName-{env}`: Metric filter logical ID
- `FedapayLiveRecordIncompleteAlarmName-{env}`: Alarm name
- `MetricNamespace-{env}`: CloudWatch metric namespace (Rendasua/Backend)
- `MetricName-{env}`: CloudWatch metric name (FedapayLiveRecordIncomplete)
