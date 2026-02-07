import fal_client


def generate_3d_test(image_url: str) -> dict:
    """Test mode: SAM 3D Objects ($0.02) — image-to-3D reconstruction."""
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


def generate_3d_demo(prompt: str) -> dict:
    """Demo mode: Hunyuan 3D v3.1 Rapid text-to-3D ($0.225) — skip image gen."""
    result = fal_client.subscribe(
        "fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d",
        arguments={
            "prompt": prompt[:200],
        },
    )

    return {
        "model_glb_url": result["model_glb"]["url"],
        "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
    }
