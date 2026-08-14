"""REMBG background removal Lambda handler."""
import base64
import io
import os
from typing import Any, Dict

# Must be set before importing rembg/pymatting (numba cache on read-only FS fails).
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp")
os.environ.setdefault("MPLCONFIGDIR", "/tmp")

from PIL import Image
# Cache model weights under U2NET_HOME (set in Dockerfile / Lambda env).
from rembg import new_session, remove
from rembg.sessions.u2net import U2netSession

# rembg 2.0.57 has no birefnet sessions; use u2net (baked into the image).
MODEL_NAME = "u2net"
session = new_session(MODEL_NAME)
if not isinstance(session, U2netSession):
    raise RuntimeError(f"Expected U2netSession, got {type(session).__name__}")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Remove background from product image using REMBG (u2net).
    
    Input: { "imageBase64": "...", "format": "jpeg|png" }
    Output: { "success": true, "imageBase64": "...", "format": "jpeg", "model": "u2net" }
    
    On error: { "success": false, "error": "...", "errorType": "..." }
    """
    try:
        # Extract and validate input
        input_b64 = event.get("imageBase64")
        if not input_b64:
            return {
                "success": False,
                "error": "Missing imageBase64 parameter",
                "errorType": "ValueError",
            }

        input_format = event.get("format", "jpeg").lower()
        if input_format not in ["jpeg", "png"]:
            input_format = "jpeg"

        # Decode input image as bytes (rembg returns bytes for bytes input)
        input_bytes = base64.b64decode(input_b64)

        # Remove background using REMBG
        # bgcolor creates a white opaque background for clean product photos
        # post_process_mask smooths edges for better quality
        output_bytes = remove(
            input_bytes,
            session=session,
            bgcolor=(255, 255, 255, 255),  # White opaque background
            post_process_mask=True,  # Smooth edges
        )
        if not isinstance(output_bytes, (bytes, bytearray)):
            raise TypeError(
                f"rembg.remove expected bytes output, got {type(output_bytes).__name__}"
            )

        # Convert to target format
        output_image = Image.open(io.BytesIO(output_bytes))
        output_buffer = io.BytesIO()

        if input_format == "jpeg":
            # Convert RGBA to RGB for JPEG (JPEG doesn't support alpha channel)
            if output_image.mode == "RGBA":
                rgb_image = Image.new("RGB", output_image.size, (255, 255, 255))
                rgb_image.paste(output_image, mask=output_image.split()[3])
                output_image = rgb_image
            output_image.save(output_buffer, format="JPEG", quality=95)
        else:
            output_image.save(output_buffer, format="PNG")

        # Encode output to base64
        output_b64 = base64.b64encode(output_buffer.getvalue()).decode("utf-8")

        return {
            "success": True,
            "imageBase64": output_b64,
            "format": input_format,
            "model": MODEL_NAME,
        }

    except Exception as e:
        # Return error details for debugging while keeping Lambda invocation successful
        return {
            "success": False,
            "error": str(e),
            "errorType": type(e).__name__,
        }
