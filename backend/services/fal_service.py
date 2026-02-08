import logging
import fal_client

logger = logging.getLogger(__name__)


def generate_3d_test(image_url: str) -> dict:
    """Test mode: SAM 3D Objects ($0.02) — image-to-3D reconstruction."""
    try:
        result = fal_client.subscribe(
            "fal-ai/sam-3/3d-objects",
            arguments={
                "image_url": image_url,
                "prompt": "solar panels",
                "export_textured_glb": True,
            },
        )

        return {
            "model_glb_url": result["model_glb"]["url"],
            "thumbnail_url": "",
        }
    except Exception as e:
        logger.error(f"fal SAM 3D Objects failed: {e}")
        raise RuntimeError(f"3D reconstruction failed: {e}") from e


def generate_3d_demo(prompt: str) -> dict:
    """Demo mode: Hunyuan3D v3 text-to-3D — returns textured GLB."""
    try:
        result = fal_client.subscribe(
            "fal-ai/hunyuan3d-v3/text-to-3d",
            arguments={
                "prompt": prompt[:200],
                "enable_pbr": True,
            },
        )

        return {
            "model_glb_url": result["model_glb"]["url"],
            "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
        }
    except Exception as e:
        logger.error(f"fal Hunyuan 3D failed: {e}")
        raise RuntimeError(f"3D generation failed: {e}") from e
