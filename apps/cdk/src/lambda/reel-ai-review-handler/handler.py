"""SQS reel AI review worker invoking the internal Nest endpoint."""
import json
import os
import requests


def handler(event, _context):
    failures = []
    for record in event.get("Records", []):
        try:
            body = json.loads(record.get("body", "{}"))
            call_backend(body["reelId"], body.get("reviewVersion", 1))
        except Exception as error:
            print(f"[ERROR] reel AI review failed: {error}")
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


def call_backend(reel_id, review_version):
    base = os.environ["BACKEND_INTERNAL_API_BASE_URL"].rstrip("/")
    key = os.environ["NOTIFICATIONS_INTERNAL_API_KEY"]
    response = requests.post(
        f"{base}/api/internal/reels/{reel_id}/ai-review",
        json={"reviewVersion": review_version},
        headers={"X-Rendasua-Internal-Key": key},
        timeout=240,
    )
    response.raise_for_status()
