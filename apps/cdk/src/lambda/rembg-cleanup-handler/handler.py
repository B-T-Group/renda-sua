"""REMBG background removal Lambda handler."""
import base64
import io
import os
from typing import Any, Dict, Optional

# Must be set before importing rembg/pymatting (numba cache on read-only FS fails).
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp")
os.environ.setdefault("MPLCONFIGDIR", "/tmp")

from PIL import Image
from rembg import new_session, remove
from rembg.sessions.u2net import U2netSession

MODEL_NAME = "u2net"
MAX_EDGE_PX = 1280
_session: Optional[U2netSession] = None


def get_session() -> U2netSession:
    """Lazy-load model during invoke (avoids Lambda INIT phase timeouts)."""
    global _session
    if _session is None:
        session = new_session(MODEL_NAME)
        if not isinstance(session, U2netSession):
            raise RuntimeError(f"Expected U2netSession, got {type(session).__name__}")
        _session = session
    return _session


def downscale_jpeg(input_bytes: bytes) -> bytes:
    """Shrink large product photos so inference stays under Lambda timeout."""
    image = Image.open(io.BytesIO(input_bytes))
    image = image.convert("RGB")
    image.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def to_output_bytes(output_bytes: bytes, input_format: str) -> bytes:
    output_image = Image.open(io.BytesIO(output_bytes))
    buf = io.BytesIO()
    if input_format == "jpeg":
        if output_image.mode == "RGBA":
            rgb = Image.new("RGB", output_image.size, (255, 255, 255))
            rgb.paste(output_image, mask=output_image.split()[3])
            output_image = rgb
        output_image.save(buf, format="JPEG", quality=92)
    else:
        output_image.save(buf, format="PNG")
    return buf.getvalue()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Remove background from product image using REMBG (u2net).

    Input: { "imageBase64": "...", "format": "jpeg|png" }
    Output: { "success": true, "imageBase64": "...", "format": "jpeg", "model": "u2net" }
    """
    try:
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

        prepared = downscale_jpeg(base64.b64decode(input_b64))
        # Skip alpha matting post-process (pymatting/numba is slow on Lambda).
        removed = remove(
            prepared,
            session=get_session(),
            bgcolor=(255, 255, 255, 255),
            post_process_mask=False,
        )
        if not isinstance(removed, (bytes, bytearray)):
            raise TypeError(
                f"rembg.remove expected bytes output, got {type(removed).__name__}"
            )

        final_bytes = to_output_bytes(bytes(removed), input_format)
        return {
            "success": True,
            "imageBase64": base64.b64encode(final_bytes).decode("utf-8"),
            "format": input_format,
            "model": MODEL_NAME,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "errorType": type(e).__name__,
        }
