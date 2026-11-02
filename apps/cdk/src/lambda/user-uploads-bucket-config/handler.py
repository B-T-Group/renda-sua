"""Merge CORS/lifecycle and force Block Public Access on rendasua-user-uploads.

Never creates or deletes the bucket. Stack Delete leaves live settings in place.
Does not put a bucket policy (no public-read policy is added).
"""

from __future__ import annotations

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

NO_CORS = "NoSuchCORSConfiguration"
NO_LIFECYCLE = "NoSuchLifecycleConfiguration"


def handler(event, context):
    request_type = event.get("RequestType", "Create")
    props = event.get("ResourceProperties") or {}
    physical_id = event.get("PhysicalResourceId") or "user-uploads-bucket-config"
    if request_type != "Delete":
        apply_config(props)
    else:
        logger.info("Delete is a no-op; bucket and settings are retained")
    return {"PhysicalResourceId": physical_id}


def apply_config(props: dict) -> None:
    import boto3

    bucket = props["BucketName"]
    client = boto3.client("s3")
    put_public_access_block(client, bucket)
    merge_cors(client, bucket, props["CorsRule"])
    merge_lifecycle(client, bucket, props["LifecycleRule"])


def put_public_access_block(client, bucket: str) -> None:
    client.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )


def merge_cors(client, bucket: str, required: dict) -> None:
    rules = _get_cors_rules(client, bucket)
    merged = upsert_cors_rule(rules, required)
    client.put_bucket_cors(Bucket=bucket, CORSConfiguration={"CORSRules": merged})


def merge_lifecycle(client, bucket: str, required: dict) -> None:
    rules = _get_lifecycle_rules(client, bucket)
    merged = upsert_lifecycle_rule(rules, required)
    client.put_bucket_lifecycle_configuration(
        Bucket=bucket, LifecycleConfiguration={"Rules": merged}
    )


def upsert_cors_rule(existing: list, required: dict) -> list:
    rule = _to_s3_cors_rule(required)
    kept = [r for r in existing if r.get("ID") != rule["ID"]]
    return kept + [rule]


def upsert_lifecycle_rule(existing: list, required: dict) -> list:
    rule = _to_s3_lifecycle_rule(required)
    kept = [r for r in existing if r.get("ID") != rule["ID"]]
    return kept + [rule]


def _to_s3_cors_rule(required: dict) -> dict:
    return {
        "ID": required["ID"],
        "AllowedOrigins": list(required["AllowedOrigins"]),
        "AllowedMethods": list(required["AllowedMethods"]),
        "AllowedHeaders": list(required["AllowedHeaders"]),
        "ExposeHeaders": list(required.get("ExposeHeaders") or ["ETag"]),
        "MaxAgeSeconds": int(required.get("MaxAgeSeconds") or 3600),
    }


def _to_s3_lifecycle_rule(required: dict) -> dict:
    days = int(required["AbortIncompleteMultipartUploadDays"])
    return {
        "ID": required["ID"],
        "Filter": {"Prefix": required["Prefix"]},
        "Status": "Enabled",
        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": days},
    }


def _get_cors_rules(client, bucket: str) -> list:
    from botocore.exceptions import ClientError

    try:
        return list(client.get_bucket_cors(Bucket=bucket).get("CORSRules") or [])
    except ClientError as error:
        if error.response["Error"]["Code"] == NO_CORS:
            return []
        raise


def _get_lifecycle_rules(client, bucket: str) -> list:
    from botocore.exceptions import ClientError

    try:
        response = client.get_bucket_lifecycle_configuration(Bucket=bucket)
        return list(response.get("Rules") or [])
    except ClientError as error:
        if error.response["Error"]["Code"] == NO_LIFECYCLE:
            return []
        raise
