"""Merge reels infra outputs into {env}-rendasua-backend-secrets."""

from __future__ import annotations

import json
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REEL_SECRET_KEYS = (
    "REELS_BUCKET_NAME",
    "REELS_CLOUDFRONT_DOMAIN",
    "REEL_MEDIA_QUEUE_URL",
    "REEL_AI_REVIEW_QUEUE_URL",
)


def handler(event, context):
    request_type = event.get("RequestType", "Create")
    props = event.get("ResourceProperties") or {}
    secret_name = props.get("SecretName") or "unknown"
    physical_id = event.get("PhysicalResourceId") or f"sync-reels-{secret_name}"
    if request_type != "Delete":
        _merge_reels_keys(props)
    return {"PhysicalResourceId": physical_id}


def _merge_reels_keys(props: dict) -> None:
    secret_name = props["SecretName"]
    updates = {key: props[key] for key in REEL_SECRET_KEYS}
    client = boto3.client("secretsmanager")
    current = json.loads(
        client.get_secret_value(SecretId=secret_name)["SecretString"]
    )
    current.update(updates)
    client.put_secret_value(
        SecretId=secret_name, SecretString=json.dumps(current)
    )
    logger.info("Synced reels keys into %s", secret_name)
