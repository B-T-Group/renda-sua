# REMBG Cleanup Lambda Handler

## Overview
This Lambda function uses REMBG with the BiRefNet model to remove backgrounds from product images. It provides a cost-effective alternative to OpenAI's image editing API (~90% cost reduction).

## Model
- **BiRefNet-general**: High-quality background removal model
- Model is loaded once per Lambda container and cached for subsequent invocations
- Typical processing time: 5-15 seconds per image

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
  "model": "birefnet-general"
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
- **Memory**: 3008 MB (BiRefNet model requires ~2GB)
- **Timeout**: 120 seconds
- **Ephemeral Storage**: 2048 MB (for model caching)
- **Runtime**: Python 3.11

## Dependencies
- `rembg`: Background removal library
- `pillow`: Image processing
- `onnxruntime`: Neural network runtime for BiRefNet model

## Cost Comparison
- REMBG Lambda: ~$0.001-0.003 per image
- OpenAI gpt-image-1-mini: ~$0.02-0.04 per image
- OpenAI gpt-image-1.5: ~$0.06-0.08 per image

**Savings**: 90-95% cost reduction compared to OpenAI
