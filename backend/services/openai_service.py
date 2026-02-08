import base64
import json
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

MODEL_VISION = "gpt-5-mini"
MODEL_VOICE = "gpt-5-nano"


async def analyze_terrain_image(image_bytes: bytes, lat: float, lon: float) -> dict:
    client = AsyncOpenAI()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = await client.responses.create(
        model=MODEL_VISION,
        reasoning={"effort": "low"},
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are a solar site assessment expert. "
                            "Return ONLY valid JSON with keys: "
                            "terrain_type, slope_estimate_deg, obstacles, "
                            "vegetation_coverage_pct, soil_assessment, "
                            "access_roads_visible, water_features_visible, "
                            "overall_suitability, recommendations."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"Analyze terrain at {lat}, {lon}.",
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{b64}",
                    },
                ],
            },
        ],
    )

    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def generate_solar_farm_render(prompt: str) -> str:
    """Generate a solar farm render image. Returns a data URI (base64)."""
    try:
        client = AsyncOpenAI()
        result = await client.images.generate(
            model="gpt-image-1.5",
            prompt=prompt,
            quality="low",
            size="1536x1024",
        )
        image = result.data[0]
        # gpt-image-1.5 returns b64_json, not url
        if image.url:
            return image.url
        if image.b64_json:
            return f"data:image/png;base64,{image.b64_json}"
        raise ValueError("No image data in response")
    except Exception as e:
        logger.error(f"GPT Image render failed: {e}")
        raise RuntimeError(f"Image generation failed: {e}") from e


async def generate_contextual_render(map_screenshot_b64: str, n_panels: int) -> str:
    """Edit the satellite screenshot to add solar panels. Returns data URI."""
    import io

    try:
        client = AsyncOpenAI()
        img_bytes = base64.b64decode(map_screenshot_b64)
        img_file = io.BytesIO(img_bytes)
        img_file.name = "screenshot.png"

        prompt = (
            f"Transform this satellite aerial view into a photorealistic render of a solar farm. "
            f"Add approximately {n_panels} ground-mounted photovoltaic panels arranged in neat rows "
            f"on this terrain. Keep the surrounding landscape visible. Realistic lighting, sharp detail."
        )

        result = await client.images.edit(
            model="gpt-image-1.5",
            image=img_file,
            prompt=prompt,
            size="1024x1024",
        )
        image = result.data[0]
        if image.url:
            return image.url
        if image.b64_json:
            return f"data:image/png;base64,{image.b64_json}"
        raise ValueError("No image data in response")
    except Exception as e:
        logger.error(f"Contextual render failed: {e}")
        raise


async def generate_voice_response(user_text: str, analysis_data: dict) -> dict:
    client = AsyncOpenAI()
    response = await client.responses.create(
        model=MODEL_VOICE,
        reasoning={"effort": "low"},
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are SolarSite's voice assistant. "
                            "Respond with JSON {spoken_response, action}. "
                            "Actions: set_time, zoom_to, toggle_heatmap, show_report, or null. "
                            f"Analysis data: {json.dumps(analysis_data)}"
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_text}],
            },
        ],
    )
    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
