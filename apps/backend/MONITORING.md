# Monitoring and Observability

This document describes health checks, metrics, error reporting, and recommended alerts for the Rendasua backend.

## Health check

- **Endpoint:** `GET /api/health`
- **Response:** JSON with `status`, `timestamp`, and optional `hasura` (Hasura connectivity and latency).
- Use this for load balancer health checks and container orchestration (e.g. Lightsail, ECS).

## Metrics

- **Endpoint:** `GET /api/metrics`
- **Format:** Prometheus-style text (e.g. `app_uptime_seconds`).
- Optional: integrate with Prometheus and Grafana for request counts and latency percentiles.

## Error reporting (Sentry)

To enable structured error reporting:

1. Create a project at [sentry.io](https://sentry.io) and obtain a DSN.
2. Set the environment variable: `SENTRY_DSN=https://...@sentry.io/...`
3. Restart the backend. Unhandled exceptions and unhandled promise rejections will be reported to Sentry.

If `SENTRY_DSN` is not set, Sentry is not initialized.

## Frontend analytics (GA4)

The frontend can load Google Analytics 4 when `enableAnalytics` is true (production). Set `REACT_APP_GA_MEASUREMENT_ID` to your GA4 Measurement ID so the Analytics component can initialize gtag.

## Recommended alerts

Configure in CloudWatch, Sentry, or your monitoring platform:

- **Order creation failures:** Alert when order-creation error rate or 5xx from `/api/orders` exceeds a threshold.
- **Payment failures:** Alert on payment callback or mobile-payment 5xx or repeated failures.
- **5xx rate:** Alert when overall 5xx response rate exceeds a threshold.
- **Health check failures:** Alert when `/api/health` returns unhealthy or Hasura is down.
- **Sentry:** Use Sentry alerts for new issues and volume spikes.

## Logging

See [README-LOGGING.md](./README-LOGGING.md) for Winston and CloudWatch logging setup.
