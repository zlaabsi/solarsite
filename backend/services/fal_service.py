import fal_client


def generate_3d_model(image_url: str) -> dict:
    result = fal_client.subscribe(
        "fal-ai/trellis-2",
        arguments={
            "image_url": image_url,
            "resolution": 1024,
        },
    )

    return {
        "model_glb_url": result["model_glb"]["url"],
        "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
    }
