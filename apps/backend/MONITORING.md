# Monitoring and Observability

This document describes health checks, metrics, error reporting, and recommended alerts for the Rendasua backend.

## Health check

- **Endpoint:** `GET /api/health`
- **Response:** JSON with `status`, `timestamp`, and `hasura` (Hasura connectivity and latency).
- **Unhealthy:** Returns HTTP **503** with `status: "unhealthy"` when Hasura is unreachable.
- Use this for load balancer health checks (Lightsail path: `/api/health`, success codes `200-399`).

## Metrics

- **Endpoint:** `GET /api/metrics`
- **Format:** Prometheus-style text (e.g. `app_uptime_seconds`).
- Optional follow-up: integrate with Prometheus and Grafana for request counts and latency percentiles.

## Request correlation

- Each request gets a `requestId` (from `X-Request-Id` or a generated UUID) stored in CLS.
- Responses include `X-Request-Id`.
- Winston logs (console + CloudWatch) include `requestId` and `userId` when available.
- CloudWatch log events are full JSON (level, message, timestamp, metadata).

## Error reporting (Sentry)

### Enable

1. Create a project at [sentry.io](https://sentry.io) and obtain a DSN.
2. Store the DSN in either:
   - AWS Secrets Manager (`development-rendasua-backend-secrets` / `production-rendasua-backend-secrets`) as `SENTRY_DSN`, and/or
   - GitHub Actions secret `SENTRY_DSN` (injected into Lightsail env by deploy-backend.yml).
3. Redeploy the backend. Release is set from `GIT_SHA` (GitHub commit SHA).

If `SENTRY_DSN` is not set, Sentry is not initialized.

### What is reported

- Uncaught exceptions / unhandled rejections (Winston handlers + Sentry when initialized).
- HTTP **5xx** via the global `AllExceptionsFilter` (with tags: path, method, `requestId`, user).
- **4xx** responses are logged but **not** sent to Sentry.

### Recommended Sentry alerts

Configure in the Sentry project UI (Slack or email):

- New issue created
- Error volume spike
- Issue regression (resolved issue reappears)

## CloudWatch Logs Insights

Example queries (adjust log group name):

```sql
fields @timestamp, level, message, requestId, path, status
| filter level = "error"
| sort @timestamp desc
| limit 50
```

```sql
fields @timestamp, level, message, method, path, status, durationMs
| filter requestId = "PASTE_REQUEST_ID"
| sort @timestamp asc
```

## Recommended CloudWatch / platform alerts

- **Health check failures:** Lightsail container unhealthy after `/api/health` returns non-2xx/3xx (including Hasura down → 503).
- **5xx rate:** Alert when overall 5xx response rate exceeds a threshold (from access logs or a future metrics export).
- **Order / payment failures:** Alert on payment callback or mobile-payment 5xx or repeated failures (Sentry issue filters by path/tag).
- **Sentry:** Prefer Sentry alerts for new issues and volume spikes (primary push channel).

## Logging

See [README-LOGGING.md](./README-LOGGING.md) for Winston and CloudWatch logging setup.

## Frontend analytics (GA4)

The frontend can load Google Analytics 4 when `enableAnalytics` is true (production). Set `REACT_APP_GA_MEASUREMENT_ID` to your GA4 Measurement ID so the Analytics component can initialize gtag.
