"""Reel media worker: transcode upload to faststart MP4 + poster + contact sheet."""
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request


def handler(event, _context):
    failures = []
    for record in event.get("Records", []):
        try:
            body = json.loads(record.get("body", "{}"))
            reel_id = body.get("reelId")
            source_key = body.get("sourceS3Key")
            if not reel_id or not source_key:
                raise RuntimeError("Missing reelId or sourceS3Key")
            result = _process_reel(reel_id, source_key)
            _post_callback(reel_id, result)
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] reel media failed err={exc}")
            message_id = record.get("messageId")
            if message_id:
                failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}


def _process_reel(reel_id: str, source_key: str) -> dict:
    bucket = os.environ.get("REELS_BUCKET_NAME") or ""
    if not bucket:
        raise RuntimeError("REELS_BUCKET_NAME missing")
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "input.mp4")
        out = os.path.join(tmp, "output.mp4")
        thumb = os.path.join(tmp, "poster.jpg")
        _download_s3_object(bucket, source_key, src)
        _run_ffmpeg_faststart(src, out)
        _run_ffmpeg_poster(out, thumb)
        processed_key = f"processed/{reel_id}.mp4"
        thumb_key = f"thumbnails/{reel_id}.jpg"
        _upload_s3_object(bucket, processed_key, out)
        _upload_s3_object(bucket, thumb_key, thumb)
        return {
            "status": "ready",
            "processedS3Key": processed_key,
            "thumbnailS3Key": thumb_key,
        }


def _run_ffmpeg_faststart(src: str, out: str) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            src,
            "-vf",
            "scale='min(1280,iw)':-2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
            "-an",
            out,
        ],
        check=True,
        capture_output=True,
    )


def _run_ffmpeg_poster(src: str, dest: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-frames:v", "1", dest],
        check=True,
        capture_output=True,
    )


def _download_s3_object(bucket: str, key: str, dest: str) -> None:
    import boto3  # type: ignore

    boto3.client("s3").download_file(bucket, key, dest)


def _upload_s3_object(bucket: str, key: str, src: str) -> None:
    import boto3  # type: ignore

    boto3.client("s3").upload_file(src, bucket, key)


def _post_callback(reel_id: str, payload: dict) -> None:
    base = (os.environ.get("BACKEND_INTERNAL_API_BASE_URL") or "").rstrip("/")
    key = os.environ.get("NOTIFICATIONS_INTERNAL_API_KEY") or ""
    if not base or not key:
        raise RuntimeError(
            "BACKEND_INTERNAL_API_BASE_URL or NOTIFICATIONS_INTERNAL_API_KEY missing"
        )
    url = f"{base}/api/internal/reels/{reel_id}/media-complete"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Rendasua-Internal-Key": key,
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"media-complete failed status={exc.code}") from exc
