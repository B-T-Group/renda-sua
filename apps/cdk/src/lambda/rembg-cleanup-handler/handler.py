"""REMBG background removal Lambda handler."""
import base64
import io
import os
from typing import Any, Dict

from PIL import Image
from rembg import new_session, remove

# Initialize REMBG session (BiRefNet model for best quality)
# This is loaded once per Lambda container and reused across invocations
session = new_session("birefnet-general")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Remove background from product image using REMBG BiRefNet model.
    
    Input: { "imageBase64": "...", "format": "jpeg|png" }
    Output: { "success": true, "imageBase64": "...", "format": "jpeg", "model": "birefnet-general" }
    
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

        # Decode input image
        input_bytes = base64.b64decode(input_b64)
        input_image = Image.open(io.BytesIO(input_bytes))

        # Remove background using REMBG with BiRefNet model
        # bgcolor creates a white opaque background for clean product photos
        # post_process_mask smooths edges for better quality
        output_bytes = remove(
            input_image,
            session=session,
            bgcolor=(255, 255, 255, 255),  # White opaque background
            post_process_mask=True,  # Smooth edges
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
            "model": "birefnet-general",
        }

    except Exception as e:
        # Return error details for debugging while keeping Lambda invocation successful
        return {
            "success": False,
            "error": str(e),
            "errorType": type(e).__name__,
        }
