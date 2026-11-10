# Rental inspection evidence bucket (production)

Prod-only private S3 bucket for rental condition-inspection photos (and later video). DEV keeps using `rendasua-user-uploads` with prefix `dev/rental-inspection/`. This stack is **not** in `deploy-cdk.yml` / `deploy-cdk-production.yml`; deploy it by hand after merge.

| | |
|---|---|
| Stack | `RentalInspectionEvidenceBucket-production` |
| Bucket | `rendasua-rental-inspection-evidence-prod` |
| Account / region | `235680477887` / `ca-central-1` |
| Prefix | `prod/rental-inspection/` for finalized objects and `.view.jpg`. Staging PUTs use `prod/rental-inspection/pending/`. |
| Nest env | `RENTAL_INSPECTION_BUCKET=rendasua-rental-inspection-evidence-prod` |

## Manual deploy

From `apps/cdk`, after this stack is on `main`:

```bash
cdk deploy RentalInspectionEvidenceBucket-production --exclusively
```

`--exclusively` deploys only this stack and does not update `RendasuaInfrastructure-production` or other stacks.

Then set `RENTAL_INSPECTION_BUCKET` on the production Nest process (Lightsail / `production-rendasua-backend-secrets`). Do not set it in DEV. Do not turn on `rental_inspection_enabled` as part of this deploy.

## Object Lock retention

Object Lock is **enabled at creation** (Governance-capable) with **no default retention**. The period is `RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS` in `src/lib/rental-inspection-evidence-config.ts` (currently empty) or CDK context `rentalInspectionObjectLockRetentionDays`.

To apply a default later (example: 365 days), set the config/context to that integer and redeploy **this stack only**. Do not hardcode a retention period in the bucket construct. A future default retention must not lock pending objects: Object Lock would keep `prod/rental-inspection/pending/` past the lifecycle expiry below.

A bucket policy denies `s3:DeleteObject`, `s3:DeleteObjectVersion`, and `s3:BypassGovernanceRetention` to every principal except the AWS account root (`arn:aws:iam::235680477887:root`). That is the break-glass path.

## IAM follow-up (not attached by this stack)

Managed policy `rendasua-rental-inspection-evidence-prod` allows only `s3:PutObject` and `s3:GetObject` on `prod/rental-inspection/*`. It is **not** attached to `admin` or `s3User`.

Attach it to the Lightsail Nest IAM user that already holds the production access keys (CDK elsewhere defaults that user to `s3User` via context `backendAwsIamUser`). If prod Nest still uses the broad `admin` keys, attach this policy to `s3User` and point Lightsail at those keys rather than widening `admin`. Do not grant `s3:DeleteObject` or `s3:BypassGovernanceRetention`.

## Pending expiry

Two lifecycle rules, both prefixed `prod/rental-inspection/pending/` and no other prefix:

- current objects expire after 2 days, and noncurrent versions after 1 day
- expired delete markers are removed (separate rule, because S3 rejects `ExpiredObjectDeleteMarker` on a rule that also has `Days`)

Noncurrent expiry is not set on any other rule. S3 applies lifecycle itself. The delete deny still blocks IAM principals other than the account root.

## No-overwrite on final keys

The bucket policy denies `s3:PutObject` when `s3:if-none-match` is null, except `prod/rental-inspection/pending/*`. Nest sends `If-None-Match: *` on the server-side PutObject of the final object and the `.view.jpg` derivative. DEV stays on `rendasua-user-uploads` (or `APPEAL_EVIDENCE_BUCKET`) and does not have this deny. The same header is a normal conditional create on those buckets, so a new key still succeeds there.

## Checksum on the browser PUT

Presign requires the file's SHA-256 hex and signs `x-amz-checksum-sha256` (base64 of that digest) with Content-Type and Content-Length. CORS allows that header. A full-body checksum has to be known before the signature, so the client computes it. Do not turn on the SDK's flexible/trailing checksum: an empty-body CRC signed into the URL makes a browser PUT 403. When a default retention is added later, S3 requires Content-MD5 or a checksum header; this signed header is that checksum.

`apps/frontend/src/services/rentalInspectionApi.ts` on the inspection UI branch already copies `signed.headers` onto the PUT. It still needs to hash the file and send `sha256` on `POST .../evidence/presign`. Same change for `apps/mobile/src/services/rentalInspectionApi.ts`. This PR does not edit that branch.

## Evidence flow this bucket matches

1. `POST .../evidence/presign` — Nest signs a PUT for `{env}/rental-inspection/pending/{bookingId}/{mediaId}.{jpg|png|webp}` (Content-Type, Content-Length, and `x-amz-checksum-sha256` pinned, 10 minutes).
2. Browser/app PUTs the file directly (web needs CORS; native mobile does not).
3. `POST .../evidence/:mediaId/finalize` — Nest HEADs and GETs the pending object, hashes it, **PutObject**s a new UUID at `{env}/rental-inspection/{bookingId}/{uuid}.ext` with `If-None-Match: *` (not CopyObject), then PutObjects an EXIF-stripped `{uuid}.view.jpg` the same way. Pending keys are not evidence.
4. `GET .../evidence/:mediaId/url` — short-lived presigned GET of the derivative.

Allowed types today are JPEG/PNG/WebP up to 8 MB. The bucket does not restrict content type, so video can land later without a bucket change.
