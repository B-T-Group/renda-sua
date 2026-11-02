"""Merge CORS/lifecycle on rendasua-user-uploads; force Block Public Access.

Reads the live config (GetBucketCors / GetBucketLifecycleConfiguration),
handles NoSuchCORSConfiguration / NoSuchLifecycleConfiguration, and upserts
our rule by ID so Put* does not wipe or duplicate other rules.

Create/Update: merge our rules, then put. BPA stays all-blocked.
Delete: remove only our rule IDs. If nothing else remains, delete that
config. Never turn Block Public Access off. Never delete the bucket.
"""

from __future__ import annotations

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

NO_CORS = "NoSuchCORSConfiguration"
NO_LIFECYCLE = "NoSuchLifecycleConfiguration"


def handler(event, context, client=None):
    request_type = event.get("RequestType", "Create")
    props = event.get("ResourceProperties") or {}
    physical_id = event.get("PhysicalResourceId") or "user-uploads-bucket-config"
    if request_type == "Delete":
        remove_our_config(props, client=client)
    else:
        apply_config(props, client=client)
    return {"PhysicalResourceId": physical_id}


def apply_config(props: dict, client=None) -> None:
    client = client or _s3_client()
    bucket = props["BucketName"]
    put_public_access_block(client, bucket)
    write_cors(
        client,
        bucket,
        upsert_cors_rule(_get_cors_rules(client, bucket), props["CorsRule"]),
    )
    write_lifecycle(
        client,
        bucket,
        upsert_lifecycle_rule(
            _get_lifecycle_rules(client, bucket), props["LifecycleRule"]
        ),
    )


def remove_our_config(props: dict, client=None) -> None:
    client = client or _s3_client()
    bucket = props["BucketName"]
    apply_rule_removal(
        client, bucket, "cors", _get_cors_rules(client, bucket), props["CorsRule"]["ID"]
    )
    apply_rule_removal(
        client,
        bucket,
        "lifecycle",
        _get_lifecycle_rules(client, bucket),
        props["LifecycleRule"]["ID"],
    )


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


def upsert_cors_rule(existing: list, required: dict) -> list:
    rule = _to_s3_cors_rule(required)
    return [r for r in existing if r.get("ID") != rule["ID"]] + [rule]


def upsert_lifecycle_rule(existing: list, required: dict) -> list:
    rule = _to_s3_lifecycle_rule(required)
    return [r for r in existing if r.get("ID") != rule["ID"]] + [rule]


def plan_rule_removal(existing: list, rule_id: str) -> tuple[str, list]:
    remaining = [r for r in existing if r.get("ID") != rule_id]
    had_ours = any(r.get("ID") == rule_id for r in existing)
    if remaining:
        return "put", remaining
    if had_ours:
        return "delete", []
    return "noop", []


def apply_rule_removal(client, bucket: str, kind: str, existing: list, rule_id: str):
    action, remaining = plan_rule_removal(existing, rule_id)
    if action == "noop":
        return
    if kind == "cors":
        write_cors(client, bucket, remaining)
        return
    write_lifecycle(client, bucket, remaining)


def write_cors(client, bucket: str, rules: list) -> None:
    if not rules:
        client.delete_bucket_cors(Bucket=bucket)
        return
    client.put_bucket_cors(Bucket=bucket, CORSConfiguration={"CORSRules": rules})


def write_lifecycle(client, bucket: str, rules: list) -> None:
    if not rules:
        client.delete_bucket_lifecycle(Bucket=bucket)
        return
    client.put_bucket_lifecycle_configuration(
        Bucket=bucket, LifecycleConfiguration={"Rules": rules}
    )


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


def _s3_client():
    import boto3

    return boto3.client("s3")


def _missing_config(error, code: str) -> bool:
    response = getattr(error, "response", None) or {}
    return response.get("Error", {}).get("Code") == code


def _get_cors_rules(client, bucket: str) -> list:
    try:
        return list(client.get_bucket_cors(Bucket=bucket).get("CORSRules") or [])
    except Exception as error:
        if _missing_config(error, NO_CORS):
            return []
        raise


def _get_lifecycle_rules(client, bucket: str) -> list:
    try:
        response = client.get_bucket_lifecycle_configuration(Bucket=bucket)
        return list(response.get("Rules") or [])
    except Exception as error:
        if _missing_config(error, NO_LIFECYCLE):
            return []
        raise
