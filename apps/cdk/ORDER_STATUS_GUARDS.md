# Order-status SQS → Lambda guards

These resources watch the `order-status-changes-{env}.fifo` → `order-status-handler-{env}` mapping so a manual disable cannot go unnoticed again.

Stacks: `OrderStatusGuard-development`, `OrderStatusGuard-production` (ca-central-1).

## What is deployed

1. **Mapping stays enabled on deploy.** `RendasuaInfrastructure` sets `enabled: true` on the order-status `SqsEventSource`. The next CDK deploy re-enables a mapping that was turned off in the console.
2. **SNS topic per env:** `order-status-guard-{development,production}` emails `tech@rendasua.com` (same pattern as FedaPay monitoring).
3. **EventBridge rules** (source `aws.lambda`, detail-type `AWS API Call via CloudTrail`):
   - `UpdateEventSourceMapping` with `requestParameters.enabled = false`
   - `DeleteEventSourceMapping`
   - Notification includes `eventName`, `userIdentity.arn`, `sourceIPAddress`, `userAgent`, `requestParameters.uUID`, `eventTime`
4. **CloudWatch alarms** on each imported FIFO queue (`treatMissingData = notBreaching`):
   - `ApproximateAgeOfOldestMessage` Maximum
     - production: > 300s for 3 × 1-minute periods
     - development: > 900s for 3 × 5-minute periods
   - `ApproximateNumberOfMessagesVisible` Maximum > 50 for 10 × 1-minute periods (both envs)

There is no IAM deny on mapping APIs. A deploy (or a console re-enable) is the recovery path.

## First-deploy checklist

1. After the first deploy of each stack, AWS SNS emails `tech@rendasua.com` a subscription confirmation. Click **Confirm subscription**. Until then the topic shows `PendingConfirmation` and alerts are not delivered.
2. CloudTrail must record **management events in ca-central-1**. EventBridge only sees `UpdateEventSourceMapping` / `DeleteEventSourceMapping` if a trail (or CloudTrail Lake) is capturing those Lambda management events in this region. Queue-age and queue-depth alarms do not depend on CloudTrail.

## After merge

`.github/workflows/deploy-cdk.yml` and `deploy-cdk-production.yml` include these stacks in the existing synth/deploy commands (same jobs as `RendasuaInfrastructure-*` and `FedapayMonitoring-*`). Do not deploy from this PR; wait for review and the normal main → prod promote.
