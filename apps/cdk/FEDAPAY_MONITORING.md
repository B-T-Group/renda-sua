# FedaPay Live Record Monitoring

This CDK infrastructure monitors the backend logs for the `fedapay_live_record_incomplete` marker, which is emitted when FedaPay mobile money transaction records are incomplete and require attention before going live in Togo.

## Overview

The monitoring infrastructure consists of:

1. **SNS Topics**: Dedicated alert topic per environment (`fedapay-monitoring-dev`, `fedapay-monitoring-production`)
2. **Email Subscriptions**: Alerts sent to `tech@rendasua.com` (requires one-time confirmation after first deploy)
3. **CloudWatch Metric Filters**: Match backend JSON log events with the pattern `{ $.message = "fedapay_live_record_incomplete tx=*" }` (so `fedapay_live_record_incomplete_repeated` lines are not counted) and publish to a custom CloudWatch metric
4. **CloudWatch Alarms**: Alert when the marker appears 2 or more times within a single 1-hour period (Sum >= 2, one 3600 s evaluation period)
5. **Per-environment setup**: Separate monitoring for dev and production environments

## Architecture

### SNS Topics

- **Dev**: `fedapay-monitoring-dev` → `tech@rendasua.com`
- **Production**: `fedapay-monitoring-production` → `tech@rendasua.com`

Each topic sends notifications for both **ALARM** (when threshold is breached) and **OK** (when alarm recovers) states.

### Metric Details

- **Namespace**: `Rendasua/Backend`
- **Metric Names**: Per-environment to avoid dimension conflicts
  - Dev: `FedapayLiveRecordIncomplete-dev`
  - Production: `FedapayLiveRecordIncomplete-production`
- **Unit**: Count (each log occurrence increments by 1)
- **Filter Pattern**: JSON pattern matching message field: `{ $.message = "fedapay_live_record_incomplete tx=*" }`
  - Parses JSON log format
  - Prevents false matches on variants like `fedapay_live_record_incomplete_repeated`

### Alarm Configuration

- **Threshold**: Sum >= 2 over a single 1-hour evaluation period
- **Missing Data Treatment**: `NOT_BREACHING` (missing data doesn't trigger the alarm)
- **Alarm Names**:
  - Dev: `fedapay-live-record-incomplete-dev`
  - Production: `fedapay-live-record-incomplete-production`
- **Actions**: Sends SNS notification on ALARM and OK state changes

### Log Groups

The metric filters monitor these CloudWatch Log Groups:

- **Dev**: `rendasua-backend-dev`
- **Production**: `rendasua-backend-prod`

## Deployment

### Automatic Deployment Flow

This infrastructure deploys automatically through GitHub Actions:

1. **QA Review**: Code review and approval on PR
2. **Merge to main**: Merge approved PR to main branch
3. **Automatic dev deployment**: GitHub Actions deploys `FedapayMonitoring-dev` stack
4. **Email confirmation**: Check `tech@rendasua.com` inbox and confirm SNS subscription
5. **Production promotion**: Push to `prod` branch (main→prod promote)
6. **Automatic prod deployment**: GitHub Actions deploys `FedapayMonitoring-production` stack
7. **Email confirmation**: Confirm production SNS subscription (if not already confirmed)

**GitHub Actions workflows**:
- **Dev**: `.github/workflows/deploy-cdk.yml` (triggered on push to `main`, path filter `apps/cdk/**`)
- **Production**: `.github/workflows/deploy-cdk-production.yml` (triggered on push to `prod` branch)

### Manual Deployment (Optional)

If you need to deploy manually or outside the normal workflow:

```bash
cd apps/cdk

# Deploy dev only
npx cdk deploy FedapayMonitoring-dev

# Deploy production only
npx cdk deploy FedapayMonitoring-production

# Deploy both (not recommended, use workflows instead)
npx cdk deploy FedapayMonitoring-dev FedapayMonitoring-production
```

### First-Time Email Confirmation

**⚠️ Important**: After the first deployment, an email confirmation is required:

1. AWS SNS will send a subscription confirmation email to `tech@rendasua.com`
2. Someone with access to that inbox must click the "Confirm subscription" link
3. The subscription will show as "PendingConfirmation" until confirmed
4. Once confirmed, alerts will be delivered to the email address

To check subscription status:

```bash
# List subscriptions for dev topic
aws sns list-subscriptions-by-topic \
  --topic-arn $(aws cloudformation describe-stacks \
    --stack-name FedapayMonitoring-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`SnsTopicArndev`].OutputValue' \
    --output text \
    --region ca-central-1) \
  --region ca-central-1
```

Look for `"SubscriptionArn": "PendingConfirmation"` (before confirmation) or an actual ARN (after confirmation).

## Verification

After deployment, verify the resources were created:

### Check SNS Topics

```bash
# List SNS topics
aws sns list-topics --region ca-central-1 | grep fedapay-monitoring
```

### Check Subscriptions

```bash
# Dev subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
  --region ca-central-1

# Production subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-production \
  --region ca-central-1
```

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

To verify the metric is being published after the backend emits the marker:

```bash
# Dev environment
aws cloudwatch get-metric-statistics \
  --namespace Rendasua/Backend \
  --metric-name FedapayLiveRecordIncomplete-dev \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ca-central-1

# Production environment
aws cloudwatch get-metric-statistics \
  --namespace Rendasua/Backend \
  --metric-name FedapayLiveRecordIncomplete-production \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
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

### SNS Console

View topics and subscriptions:

1. Go to: https://console.aws.amazon.com/sns/
2. Region: ca-central-1
3. Navigate to **Topics**
4. Search for: `fedapay-monitoring`

### Alarm States

- **OK**: Fewer than 2 incomplete records detected in a 1-hour window
- **ALARM**: 2 or more incomplete records detected in a 1-hour window
- **INSUFFICIENT_DATA**: Alarm just created or no data points yet

### Email Notifications

When the alarm triggers (ALARM state):
- **Subject**: `ALARM: "fedapay-live-record-incomplete-{env}" in ca-central-1`
- **Body**: Includes alarm details, threshold breach information, and timestamp
- **From**: `no-reply@sns.amazonaws.com`

When the alarm recovers (OK state):
- **Subject**: `OK: "fedapay-live-record-incomplete-{env}" in ca-central-1`
- **Body**: Confirmation that the alarm has returned to OK state

## Adding More Subscribers

To add additional email addresses, Slack channels, or other notification endpoints:

### Via AWS Console

1. Go to SNS console → Topics
2. Select `fedapay-monitoring-dev` or `fedapay-monitoring-production`
3. Click "Create subscription"
4. Choose protocol (Email, HTTPS, Lambda, etc.)
5. Enter endpoint
6. Confirm subscription (for email)

### Via AWS CLI

```bash
# Add another email
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
  --protocol email \
  --notification-endpoint another-email@example.com \
  --region ca-central-1

# Add Slack via HTTPS webhook
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
  --protocol https \
  --notification-endpoint https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --region ca-central-1
```

### Via CDK (Code Change)

Edit `apps/cdk/src/lib/fedapay-monitoring-stack.ts` and add more subscriptions:

```typescript
alarmTopic.addSubscription(
  new subscriptions.EmailSubscription('another-email@example.com')
);

alarmTopic.addSubscription(
  new subscriptions.UrlSubscription('https://hooks.slack.com/services/YOUR/WEBHOOK/URL')
);
```

Then redeploy the stack.

## Troubleshooting

### Email not received

1. **Check spam folder** in tech@rendasua.com inbox
2. **Verify subscription is confirmed**:
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
     --region ca-central-1
   ```
   Look for `"SubscriptionArn": "PendingConfirmation"` – if present, click the confirmation link in the email

3. **Test SNS topic manually**:
   ```bash
   aws sns publish \
     --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
     --message "Test notification" \
     --subject "Test" \
     --region ca-central-1
   ```

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
     --filter-pattern '{ $.message = "fedapay_live_record_incomplete tx=*" }' \
     --region ca-central-1
   ```

3. Verify the metric filter is active:
   ```bash
   aws logs describe-metric-filters \
     --log-group-name rendasua-backend-dev \
     --region ca-central-1
   ```

4. Check metric data points:
   ```bash
   # Dev
   aws cloudwatch get-metric-statistics \
     --namespace Rendasua/Backend \
     --metric-name FedapayLiveRecordIncomplete-dev \
     --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 3600 \
     --statistics Sum \
     --region ca-central-1
   ```

### Subscription shows PendingConfirmation

This means the confirmation email was sent but not clicked:

1. Check tech@rendasua.com inbox and spam folder
2. Look for email from `no-reply@sns.amazonaws.com`
3. Click "Confirm subscription" link
4. If email is lost, delete and recreate the subscription:
   ```bash
   # Get subscription ARN
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
     --region ca-central-1

   # Unsubscribe (if needed)
   aws sns unsubscribe \
     --subscription-arn <SUBSCRIPTION_ARN> \
     --region ca-central-1

   # Re-subscribe
   aws sns subscribe \
     --topic-arn arn:aws:sns:ca-central-1:235680477887:fedapay-monitoring-dev \
     --protocol email \
     --notification-endpoint tech@rendasua.com \
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

**Note**: This will delete the SNS topics and all subscriptions.

## Related

- **Log marker PR**: renda-sua#587 (backend code that emits the marker)
- **Context**: This monitoring is a precondition for FedaPay going live in Togo
- **Region**: ca-central-1 (all Rendasua infrastructure)

## Stack Outputs

After deployment, the stack exports these values:

- `SnsTopicArn-{env}`: SNS topic ARN for alerts
