# REMBG Cleanup Lambda Handler

## Overview
This Lambda function uses REMBG (`u2net`) to remove backgrounds from product
images. It is a cost-effective alternative to OpenAI image editing.

## Model
- **u2net**: General-purpose background removal (baked into the container image)
- Session is created once per Lambda container and reused across invocations
- Typical processing time: 5–15 seconds per image (cold start longer)

> rembg `2.0.57` does not include BiRefNet session modules; unknown model names
> silently fall back to u2net. Keep the handler on an explicit `u2net` session.

## Input
```json
{
  "imageBase64": "base64-encoded-image-data",
  "format": "jpeg|png"
}
```

## Output (Success)
```json
{
  "success": true,
  "imageBase64": "base64-encoded-processed-image",
  "format": "jpeg",
  "model": "u2net"
}
```

## Output (Error)
```json
{
  "success": false,
  "error": "Error description",
  "errorType": "ExceptionClassName"
}
```

## Configuration
- **Memory**: 3008 MB
- **Timeout**: 120 seconds
- **Ephemeral Storage**: 2048 MB
- **Runtime**: Python 3.11 (container image)
- **Env**: `U2NET_HOME=/opt/models`, `NUMBA_CACHE_DIR=/tmp`

## Packaging

Deployed as a **Lambda container image** (not a zip). CDK builds
`Dockerfile` and pushes to ECR via `DockerImageFunction`.

Dependencies (`rembg`, `pillow`, `onnxruntime`) and u2net weights are baked
into the image at build time. Model files are `chmod a+rX` so the Lambda
runtime user can read them.

## Cost Comparison
- REMBG Lambda: ~$0.001-0.003 per image
- OpenAI gpt-image-1-mini: ~$0.02-0.04 per image
- OpenAI gpt-image-1.5: ~$0.06-0.08 per image

**Savings**: 90-95% cost reduction compared to OpenAI
